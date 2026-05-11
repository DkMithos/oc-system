/**
 * scripts/migrar-flujos.js
 * Migración de Excel → Firestore para los flujos financieros.
 *
 * Uso:
 *   node scripts/migrar-flujos.js [--dry-run] [--area admin|contabilidad|ti|operaciones|all]
 *
 * Fuentes:
 *   Admin       → Flujo Administración Contabilidad TI 2026.xlsx  [BD ADMIN]
 *   Contabilidad→ Flujo Administración Contabilidad TI 2026.xlsx  [BD CONTA]
 *   TI          → Flujo Administración Contabilidad TI 2026.xlsx  [BD TI]
 *   Operaciones → Flujo de proyectos.xlsx                         [BASE DE DATOS]
 */

const path  = require("path");
const fs    = require("fs");
const XLSX  = require("xlsx");

// ── Config ────────────────────────────────────────────────────
const BASE_EXCEL = "C:/Users/URSULA/OneDrive - MEMPHIS MAQUINARIAS S.A.C/Flujo Financiero - Flujo Financiero";
const PROJECT_ID = "oc-system-3910d";
const COL        = "transaccionesFinancieras";

const ARGS     = process.argv.slice(2);
const DRY_RUN  = ARGS.includes("--dry-run");
const AREA_ARG = (ARGS.find(a => a.startsWith("--area=")) || "").replace("--area=","") || "all";

// ── Firebase Admin (usa token del CLI) ────────────────────────
const adminPkg  = path.join(__dirname, "../functions/node_modules/firebase-admin");
const admin     = require(adminPkg);

const credFile  = path.join(process.env.USERPROFILE, ".config/configstore/firebase-tools.json");
const cliCreds  = JSON.parse(fs.readFileSync(credFile, "utf8"));
const tokens    = cliCreds.tokens;

// client_secret es la clave pública del CLI de Firebase (open-source en firebase-tools/lib/api.js)
admin.initializeApp({
  credential: admin.credential.refreshToken({
    type:          "authorized_user",
    client_id:     "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6i8b.apps.googleusercontent.com",
    client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
    refresh_token: tokens.refresh_token,
  }),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// ── Utilidades de fecha ───────────────────────────────────────
function serialToMes(v) {
  if (!v && v !== 0) return null;
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y) return null;
    return `${d.y}-${String(d.m).padStart(2,"0")}`;
  }
  const s = String(v).trim().toLowerCase();
  const meses = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
    ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
  };
  const m = s.match(/([a-záéíóú]+)[^\d]*(\d{2,4})/);
  if (m) {
    const key = m[1].slice(0,3).normalize("NFD").replace(/[̀-ͯ]/g,"");
    const num = meses[m[1]] || meses[key];
    if (num) {
      const year = m[2].length === 2 ? `20${m[2]}` : m[2];
      return `${year}-${String(num).padStart(2,"0")}`;
    }
  }
  return null;
}

function serialToISO(v) {
  if (!v || typeof v !== "number") return null;
  const d = XLSX.SSF.parse_date_code(v);
  if (!d || !d.y) return null;
  return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
}

function normMoneda(v) {
  const s = String(v || "").trim();
  if (["S/","Soles","PEN","S"].includes(s)) return "PEN";
  if (["$","USD","Dólares","Dolares"].includes(s)) return "USD";
  return "PEN";
}

function normEstado(v) {
  const s = String(v || "").trim().toUpperCase();
  if (s === "PAGADO") return "Pagado";
  if (s.includes("PARCIAL") || s.includes("PARTIAL")) return "Pago Parcial";
  return "Pendiente";
}

function toNum(v) {
  if (v === "" || v === null || v === undefined || v === "-") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g,""));
  return isNaN(n) ? null : n;
}

function toStr(v) { return String(v || "").trim(); }

const NOW = admin.firestore.Timestamp.now();

// ── Parser Admin / Contabilidad / TI ─────────────────────────
function parsarEstandar(r, area) {
  const montoTotal = toNum(r["MONTO EJECUTADO"]);
  if (!montoTotal || montoTotal === 0) return null;
  const mesVenc = serialToMes(r["MES VENCIMIENTO"]);
  if (!mesVenc) return null;
  const proveedor = toStr(r["PROVEEDOR"]);
  if (!proveedor) return null;

  const moneda    = normMoneda(r["MONEDA"]);
  const tc        = toNum(r["TC"]);
  const monto_sin = +(montoTotal / 1.18).toFixed(2);
  const igv       = +(montoTotal - monto_sin).toFixed(2);
  const montoPen  = moneda === "PEN" ? montoTotal : (tc ? +(montoTotal * tc).toFixed(2) : null);

  // DETRACCIÓN: si está entre 0 y 1 es tasa, si > 1 es monto
  const detRaw = toNum(r["DETRACCIÓN"] || r["DETRACCION"]);
  const detraccion = detRaw != null
    ? (detRaw > 0 && detRaw <= 1 ? +(montoTotal * detRaw).toFixed(2) : detRaw)
    : null;
  const retencion = toNum(r["RETENCIÓN"] || r["RETENCION"]);

  return {
    area,
    tipo:           "EGRESO",
    clasificacion:  "OPEX",
    // Proveedor
    proveedor_cliente_nombre: proveedor,
    proveedor_cliente_id:     "",
    // Centro de costo
    centro_costo_nombre: toStr(r["CDC"]),
    centro_costo_id:     null,
    // Categoría / concepto
    categoriaNombre:  toStr(r["CATEGORIA"]),
    subcategoriaNombre: "",
    notas: [toStr(r["CONCEPTO"]), toStr(r["OBSERVACIONES"])].filter(Boolean).join(" | "),
    // Montos
    moneda,
    tc:                tc || null,
    monto_sin_igv:     monto_sin,
    igv,
    monto_total:       montoTotal,
    monto_total_pen:   montoPen,
    // Presupuesto
    montoPresupuestado: toNum(r["MONTO PRESUPUESTADO"]) || montoTotal,
    montoPagado:        toNum(r["MONTO PAGADO"]),
    // Detracciones
    detraccion,
    retencion: retencion && retencion !== 0 ? retencion : null,
    // Fechas planificación
    mesVencimiento:  mesVenc,
    mesPagado:       serialToMes(r["MES PAGADO"]),
    mesProgramado:   serialToMes(r["MES PROGRAMADO"]),
    // Estado
    estado:          normEstado(r["PAGADO/PENDIENTE"]),
    postergado:      Number(r["POSTERGADO"] || 0) > 0,
    // Método de pago / timing
    metodoPago: "",
    momento:    toStr(r["MOMENTO"]),
    // Fechas Firestore
    fecha:          admin.firestore.Timestamp.now(),
    programado_fecha: null,
    fechaISO:       mesVenc + "-01",
    // Auditoría
    creadoEn:       admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn:  admin.firestore.FieldValue.serverTimestamp(),
    creadoPor:      "migracion-excel-2026",
    importado:      true,
    // Doc
    documento_tipo:   "",
    documento_numero: toStr(r["OBSERVACIONES"]).includes("-") ? toStr(r["OBSERVACIONES"]) : "",
    oc_numero:  "",
    oc_id:      null,
  };
}

// ── Parser Operaciones ────────────────────────────────────────
function parsarOperaciones(r) {
  const proveedor = toStr(r["PROVEEDOR"]);
  if (!proveedor || proveedor.toUpperCase() === "ESTIMADO" || !proveedor) return null;

  const montoTotal   = toNum(r["TOTAL"]);
  const totalSoles   = toNum(r[" TOTAL SOLES "] || r["TOTAL SOLES"]);
  const montoFinal   = totalSoles || montoTotal;
  if (!montoFinal || montoFinal === 0) return null;

  const mesVenc = serialToMes(r["MES DE VENCIMIENTO"]) || serialToMes(r[" MES DE VENCIMIENTO "]);
  if (!mesVenc) return null;

  const moneda = normMoneda(r["MONEDA"]);
  const tc     = toNum(r["TC"]);
  const monto_sin = +(montoFinal / 1.18).toFixed(2);
  const igv       = +(montoFinal - monto_sin).toFixed(2);

  const pagadoRaw  = toStr(r[" PAGADO "] || r["PAGADO"] || "").trim().toUpperCase();
  const estado     = normEstado(pagadoRaw || "PENDIENTE");

  const fechaInicioISO = serialToISO(r["FECHA INICIO"]);
  const mesProg        = serialToMes(r["MES DE PROGRAMACION"] || r[" MES DE PROGRAMACION "]);

  return {
    area: "operaciones",
    tipo:           "EGRESO",
    clasificacion:  "OPEX",
    // Proveedor
    proveedor_cliente_nombre: proveedor,
    proveedor_cliente_id:     "",
    // Centro de costo
    centro_costo_nombre: toStr(r["CDC"]),
    centro_costo_id:     null,
    // Categoría / concepto
    categoriaNombre:    toStr(r["CATEGORIA"]),
    subcategoriaNombre: "",
    notas:              toStr(r["CONCEPTO"]),
    // Montos
    moneda,
    tc:                tc || null,
    monto_sin_igv:     monto_sin,
    igv,
    monto_total:       montoFinal,
    monto_total_pen:   moneda === "PEN" ? montoFinal : (tc ? +(montoFinal * tc).toFixed(2) : null),
    // Presupuesto
    montoPresupuestado: toNum(r["PRESUPUESTADO"]) || montoFinal,
    montoPagado:        null,
    // Detracciones
    detraccion: null,
    retencion:  null,
    // Campos Operaciones
    codigoItem:     toStr(r["CÓDIGO"] || r["CODIGO"]),
    cantidad:       toNum(r["CANTIDAD"]),
    precioUnitario: toNum(r["PU"]),
    diasCredito:    toNum(r["DIAS DE CREDITO"] || r["DÍAS DE CRÉDITO"]),
    fechaInicio:    fechaInicioISO || "",
    metodoPago:     toStr(r["METODO DE PAGO"] || r["MÉTODO DE PAGO"]),
    // Planificación
    mesVencimiento: mesVenc,
    mesPagado:      null,
    mesProgramado:  mesProg,
    // Estado
    estado,
    postergado: /SI|YES|1|X/i.test(toStr(r["POSTERGADO"])),
    // Fechas Firestore
    fecha:           admin.firestore.Timestamp.now(),
    programado_fecha: null,
    fechaISO:        fechaInicioISO || mesVenc + "-01",
    // Auditoría
    creadoEn:    admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoPor:   "migracion-excel-2026",
    importado:   true,
    // Doc
    documento_tipo:   "",
    documento_numero: "",
    oc_numero:  "",
    oc_id:      null,
  };
}

// ── Batch write ───────────────────────────────────────────────
const CHUNK = 400;

async function importarLote(docs, area) {
  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${area}: ${docs.length} docs — no se escribió nada`);
    return docs.length;
  }
  const colRef = db.collection(COL);
  let importados = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + CHUNK);
    chunk.forEach(d => batch.set(colRef.doc(), d));
    await batch.commit();
    importados += chunk.length;
    console.log(`  ✓ ${area}: ${importados}/${docs.length} escritos`);
  }
  return importados;
}

// ── Tareas ────────────────────────────────────────────────────
const TAREAS = [
  {
    area:   "administracion",
    xlsx:   "Flujo Administración Contabilidad TI 2026.xlsx",
    sheet:  "BD ADMIN",
    parser: (r) => parsarEstandar(r, "administracion"),
  },
  {
    area:   "contabilidad",
    xlsx:   "Flujo Administración Contabilidad TI 2026.xlsx",
    sheet:  "BD CONTA",
    parser: (r) => parsarEstandar(r, "contabilidad"),
  },
  {
    area:   "ti",
    xlsx:   "Flujo Administración Contabilidad TI 2026.xlsx",
    sheet:  "BD TI",
    parser: (r) => parsarEstandar(r, "ti"),
  },
  {
    area:   "operaciones",
    xlsx:   "Flujo de proyectos.xlsx",
    sheet:  "BASE DE DATOS",
    parser: parsarOperaciones,
  },
];

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Migración Excel → Firestore ${DRY_RUN ? "[DRY-RUN]" : "[PRODUCCIÓN]"}`);
  console.log(`   Proyecto: ${PROJECT_ID}  |  Colección: ${COL}`);
  console.log(`   Área: ${AREA_ARG}\n`);

  let totalImportado = 0;

  for (const tarea of TAREAS) {
    if (AREA_ARG !== "all" && AREA_ARG !== tarea.area) continue;

    console.log(`\n📂 ${tarea.area.toUpperCase()} — ${tarea.sheet}`);
    const xlsxPath = path.join(BASE_EXCEL, tarea.xlsx);
    const wb       = XLSX.readFile(xlsxPath);
    const ws       = wb.Sheets[tarea.sheet];
    const rows     = XLSX.utils.sheet_to_json(ws, { defval: "" });

    const docs = [];
    let omitidos = 0;
    for (const r of rows) {
      const doc = tarea.parser(r);
      if (doc) docs.push(doc);
      else omitidos++;
    }
    console.log(`   Leídas: ${rows.length} | Válidas: ${docs.length} | Omitidas: ${omitidos}`);
    if (docs.length > 0) {
      const n = await importarLote(docs, tarea.area);
      totalImportado += n;
    }
  }

  console.log(`\n✅ Migración completa. Total importado: ${totalImportado} documentos.`);
  process.exit(0);
}

main().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
