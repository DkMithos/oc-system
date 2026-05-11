/**
 * scripts/migrar-flujos.cjs
 * Migración de Excel → Firestore para los flujos financieros.
 *
 * Uso:
 *   node scripts/migrar-flujos.cjs [--dry-run] [--area=administracion|contabilidad|ti|operaciones|all]
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

// ── Firebase Admin — usa gcloud ADC ──────────────────────────
const adminPkg = path.join(__dirname, "../functions/node_modules/firebase-admin");
const admin    = require(adminPkg);

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId:  PROJECT_ID,
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
    enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6,
    julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12,
    ene:1, feb:2, mar:3, abr:4, may:5, jun:6, jul:7, ago:8, sep:9, set:9, oct:10, nov:11, dic:12,
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
  if (["$","USD","Dolares","Dólares"].includes(s)) return "USD";
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

// ── Normalización de Categorías ───────────────────────────────
// Convención: Title Case para todas las áreas. Acrónimos en MAYÚSCULA (AFP, IGV, SUNAT...).
// Conceptos iguales entre áreas reciben el mismo nombre final.
const NORM_CAT = {
  // ── ADMINISTRACIÓN ────────────────────────────────────────
  "36000000":                          "Sin Categoría",
  "Alquiler de vivienda socios":       "Alquiler de Vivienda Socios",
  "Arbitrio":                          "Arbitrios",
  "Arbitrios socios":                  "Arbitrios Socios",
  "Auditoria":                         "Auditoría",
  "Caja chica dólares":                "Caja Chica Dólares",
  "Caja chica soles":                  "Caja Chica Soles",
  "Derechos Notariales y Registrales": "Derechos Notariales y Registrales",
  "Deuda asignación familiar":         "Deuda Asignación Familiar",
  "Dispensador de Agua":               "Dispensador de Agua",
  "Gastos de integración":             "Gastos de Integración",
  "Honorarios socios":                 "Honorarios Socios",
  "Internet servidor":                 "Internet Servidor",
  "Licencia Teams":                    "Licencias",
  "Liquidaciones de trabajadores":     "Liquidaciones de Trabajadores",
  "Mantenimiento socios":              "Mantenimiento Socios",
  "Muebles oficina":                   "Muebles de Oficina",
  "Ontier Informe Surco":              "Asesoría Legal",
  "PAS PNP":                           "PAS PNP",
  "Plataforma Laboral":                "Plataforma Laboral",
  "Préstamos socios":                  "Préstamos Socios",
  "Préstamos terceros":                "Préstamos Terceros",
  "Préstamos trabajadores":            "Préstamos Trabajadores",
  "San Miguel Arbitraje":              "Arbitraje",
  "Surco Arbitraje":                   "Arbitraje",
  "Seguro de Vida Ley":                "Seguro de Vida Ley",
  "Servicio contable":                 "Servicio Contable",
  "Servicio de Luz":                   "Servicios Básicos",
  "Servicios socios":                  "Servicios Socios",
  "Sistema contable":                  "Sistema Contable",
  "Tarjeta capital":                   "Tarjeta Capital",
  "Ugaz Compliance":                   "Asesoría Legal",
  "Ugaz Demartini":                    "Asesoría Legal",
  "Ugaz Macher":                       "Asesoría Legal",
  "Ugaz Mediático":                    "Asesoría Legal",
  "Utilidad Guillermo Macher":         "Utilidad Socios",
  "Utilidad Miguel Zegarra":           "Utilidad Socios",
  // ── CONTABILIDAD ──────────────────────────────────────────
  "AFP gastos administrativos":        "AFP Gastos Administrativos",
  "ESSALUD":                           "EsSalud",
  // ── TI ────────────────────────────────────────────────────
  "DATABASE":                          "Base de Datos",
  "DESPLIEGUE":                        "Despliegue",
  "EQUIPOS TECNOLOGICOS":              "Equipos Tecnológicos",
  "HOSTING Y DOMINIOS":                "Hosting y Dominios",
  "LICENCIAS":                         "Licencias",
  "MANTENIMIENTO":                     "Mantenimiento",
  "REDES E INTERNET":                  "Redes e Internet",
  "SERVICIOS CLOUD":                   "Servicios Cloud",
  // ── PROYECTOS/OPERACIONES ─────────────────────────────────
  "ACCESORIOS":                        "Accesorios",
  "ADICIONALES":                       "Adicionales",
  "ALMACEN":                           "Almacén",
  "COMUNICACIÓN":                      "Comunicación",
  "DEDUCIBLE":                         "Deducible",
  "DESGASTES":                         "Desgastes",
  "DEVOLUCION A LA ENTIDAD":           "Devolución a la Entidad",
  "EQQUIPOS DE BOMBEROS":              "Equipos de Bomberos",
  "EQUIPOS DE BOMBEROS":               "Equipos de Bomberos",
  "EQUIPAMIENTO":                      "Equipamiento",
  "EQUIPAMIENTO DE ALMACEN":           "Equipamiento de Almacén",
  "EQUIPAMIENTO DE SEGURIDAD":         "Equipamiento de Seguridad",
  "EQUIPAMIENTO DE TALLER":            "Equipamiento de Taller",
  "EQUIPAMIENTO DE TELEMETRIA":        "Equipamiento de Telemetría",
  "EQUIPAMIENTO DEL BUS":              "Equipamiento del Bus",
  "EQUIPAMIENTO DEL VEHICULO":         "Equipamiento del Vehículo",
  "EQUIPAMIENTO DEL VEHÍCULO":         "Equipamiento del Vehículo",
  "EQUIPAMIENTO MEDICO":               "Equipamiento Médico",
  "EQUIPAMIENTO TECNOLOGICO":          "Equipos Tecnológicos",
  "FIANZA":                            "Fianzas",
  "G. ADMINISTRATIVOS":                "Gastos Administrativos",
  "G. DE GESTIÓN":                     "Gastos de Gestión",
  "GASTOS DE GESTIÓN":                 "Gastos de Gestión",
  "GASTOS MEMPHIS":                    "Gastos Operativos",
  "GASTOS OPERATIVOS":                 "Gastos Operativos",
  "GPS":                               "GPS",
  "HABITÁCULO":                        "Habitáculo",
  "HERRAMIENTAS HIDRAULICAS":          "Herramientas Hidráulicas",
  "HERRAMIENTAS V.":                   "Herramientas Varias",
  "HIDROAMBULANCIA":                   "Hidroambulancia",
  "IMPUESTOS":                         "Impuestos",
  "INGRESOS":                          "Ingresos",
  "INMATRICULACIÓN":                   "Inmatriculación",
  "INSUMOS MEDICOS":                   "Insumos Médicos",
  "MATERIALES E INSUMOS MEDICOS":      "Insumos Médicos",
  "INTERNET":                          "Internet",
  "MANTENIMIENTO DE EQUIPOS MÉDICOS":  "Mantenimiento Equipos Médicos",
  "MANTENIMIENTO VEHÍCULAR":           "Mantenimiento Vehicular",
  "MARKETING":                         "Marketing",
  "MEDICAMENTO":                       "Medicamentos",
  "MOBILIARIO DE HOSPITALES":          "Mobiliario de Hospitales",
  "MOTOS":                             "Motos",
  "PROYECTOS":                         "Proyectos",
  "REPARACIÓN DE SINIESTROS":          "Reparación por Siniestro",
  "REPARACIÓN POR DESGASTE":           "Reparación por Desgaste",
  "RETIRO DE EQUIPOS":                 "Retiro de Equipos",
  "SEGUROS":                           "Seguros",
  "SINIESTRO":                         "Siniestro",
  "Supervisión":                       "Supervisión",
  "TRASLADO":                          "Traslado",
  "UNIFORME DE BOMBERO FORESTAL":      "Uniforme Forestal de Bombero",
  "UNIFORMES FORESTALES":              "Uniforme Forestal de Bombero",
  "UNIFORME DE RESCATE":               "Uniforme de Rescate",
  "UNIFORMES DE BOMBERO":              "Uniforme de Bombero",
  "VEHÍCULOS":                         "Vehículos",
  "VIATICOS":                          "Viáticos",
};

// ── Normalización de CDC ──────────────────────────────────────
// Convención: Title Case. Códigos de proyecto → nombre completo legible.
const NORM_CDC = {
  // ── ADMIN ─────────────────────────────────────────────────
  "Total":                  "",
  "ALQUILER DE SOCIOS":     "Alquiler de Socios",
  "FIANZAS":                "Fianzas",
  "GASTOS OFICINA CENTRAL": "Gastos Oficina Central",
  "GASTOS TRABAJADORES":    "Gastos Trabajadores",
  "HONORARIOS SOCIOS":      "Honorarios Socios",
  "LEGAL":                  "Legal",
  "PRÉSTAMOS":              "Préstamos",
  "UTILIDAD":               "Utilidad",
  // ── CONTABILIDAD ──────────────────────────────────────────
  "4TA CATEGORÍA":          "4ta Categoría",
  "5TA CATEGORÍA":          "5ta Categoría",
  "BRAVO 3":                "Bravo 3",
  "DETRACCION":             "Detracción",
  "FRACCIONAMIENTO SUNAT":  "Fraccionamiento SUNAT",
  "IGV":                    "IGV",
  "ITAN":                   "ITAN",
  "RENTA 3RA  MENSUAL":     "Renta 3ra Mensual",
  "RENTA ANUAL 2025":       "Renta Anual 2025",
  "RETENCION 3%":           "Retención 3%",
  // ── TI (CDC = misma estructura que CATEGORÍA) ─────────────
  "DATABASE":               "Base de Datos",
  "DESPLIEGUE":             "Despliegue",
  "EQUIPOS TECNOLOGICOS":   "Equipos Tecnológicos",
  "HOSTING Y DOMINIOS":     "Hosting y Dominios",
  "LICENCIAS":              "Licencias",
  "MANTENIMIENTO":          "Mantenimiento",
  "REDES E INTERNET":       "Redes e Internet",
  "SERVICIOS CLOUD":        "Servicios Cloud",
  // ── PROYECTOS — mantener códigos exactos del sistema ─────
  // (se crean en centrosCosto si no existen — ver script separado)
  "ALMACEN":                "ALMACEN",
  "BANCOS":                 "BANCOS",
};

function normCat(v) {
  const s = toStr(v);
  return NORM_CAT[s] ?? NORM_CAT[s.toUpperCase()] ?? s;
}
function normCDC(v) {
  const s = toStr(v);
  return NORM_CDC[s] ?? NORM_CDC[s.toUpperCase()] ?? s;
}

const NOW = admin.firestore.Timestamp.now();

// ── Parser Admin / Contabilidad / TI ─────────────────────────
function parsarEstandar(r, area) {
  const proveedor = toStr(r["PROVEEDOR"]);
  if (!proveedor || /^\d+\.?\d*$/.test(proveedor)) return null;

  const montoEjec  = toNum(r["MONTO EJECUTADO"]);
  const montoPres  = toNum(r["MONTO PRESUPUESTADO"]);
  const montoTotal = montoEjec != null ? montoEjec : (montoPres || 0);

  // Fecha: MES VENCIMIENTO → fallback MES PROGRAMADO → fallback fin de año
  const mesVenc = serialToMes(r["MES VENCIMIENTO"]) || serialToMes(r["MES PROGRAMADO"]) || "2026-12";

  const moneda   = normMoneda(r["MONEDA"]);
  const tc       = toNum(r["TC"]);
  const monto_sin = +(montoTotal / 1.18).toFixed(2);
  const igv       = +(montoTotal - monto_sin).toFixed(2);
  const montoPen  = moneda === "PEN" ? montoTotal : (tc ? +(montoTotal * tc).toFixed(2) : null);

  // DETRACCIÓN: si 0 < valor ≤ 1 es tasa; si > 1 es monto directo
  const detRaw    = toNum(r["DETRACCIÓN"] || r["DETRACCION"]);
  const detraccion = detRaw != null
    ? (detRaw > 0 && detRaw <= 1 ? +(montoTotal * detRaw).toFixed(2) : detRaw)
    : null;
  const retencion = toNum(r["RETENCIÓN"] || r["RETENCION"]);

  return {
    area,
    tipo:          "EGRESO",
    clasificacion: "OPEX",
    proveedor_cliente_nombre: proveedor,
    proveedor_cliente_id:     "",
    centro_costo_nombre:      normCDC(r["CDC"]),
    centro_costo_id:          null,
    categoriaNombre:          normCat(r["CATEGORIA"]),
    subcategoriaNombre:       "",
    notas: [toStr(r["CONCEPTO"]), toStr(r["OBSERVACIONES"])].filter(Boolean).join(" | "),
    moneda,
    tc:               tc || null,
    monto_sin_igv:    monto_sin,
    igv,
    monto_total:      montoTotal,
    monto_total_pen:  montoPen,
    montoPresupuestado: montoPres != null ? montoPres : montoTotal,
    montoPagado:        toNum(r["MONTO PAGADO"]),
    detraccion,
    retencion: retencion && retencion !== 0 ? retencion : null,
    mesVencimiento:  mesVenc,
    mesPagado:       serialToMes(r["MES PAGADO"]),
    mesProgramado:   serialToMes(r["MES PROGRAMADO"]),
    estado:          normEstado(r["PAGADO/PENDIENTE"]),
    postergado:      Number(r["POSTERGADO"] || 0) > 0,
    metodoPago:      "",
    momento:         toStr(r["MOMENTO"]),
    fecha:           admin.firestore.Timestamp.fromDate(new Date(mesVenc + "-01T12:00:00Z")),
    programado_fecha: null,
    fechaISO:        mesVenc + "-01",
    creadoEn:        admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn:   admin.firestore.FieldValue.serverTimestamp(),
    creadoPor:       "migracion-excel-2026",
    importado:       true,
    documento_tipo:   "",
    documento_numero: toStr(r["OBSERVACIONES"]).includes("-") ? toStr(r["OBSERVACIONES"]) : "",
    oc_numero: "",
    oc_id:     null,
  };
}

// ── Parser Proyectos/Operaciones ──────────────────────────────
function parsarOperaciones(r) {
  let proveedor = toStr(r["PROVEEDOR"]);
  if (/^\d+\.?\d*$/.test(proveedor)) return null;

  if (!proveedor) {
    const cdc      = toStr(r["CDC"]);
    const concepto = toStr(r["CONCEPTO"]);
    const total    = Number(String(r["TOTAL"]||"").replace(/[^0-9.\-]/g,""));
    if (!cdc && !concepto) return null;
    if (isNaN(total) || total <= 0 || total > 1e9) return null;
    proveedor = "Por definir";
  }

  const montoTotal = toNum(r["TOTAL"]);
  const totalSoles = toNum(r[" TOTAL SOLES "] || r["TOTAL SOLES"]);
  const montoFinal = totalSoles != null ? totalSoles : (montoTotal != null ? montoTotal : 0);

  const mesVenc = serialToMes(r["MES DE VENCIMIENTO"]) || serialToMes(r[" MES DE VENCIMIENTO "])
               || serialToMes(r["MES DE PROGRAMACION"]) || serialToMes(r[" MES DE PROGRAMACION "]);
  if (!mesVenc) return null;

  const moneda    = normMoneda(r["MONEDA"]);
  const tc        = toNum(r["TC"]);
  const monto_sin = montoFinal ? +(montoFinal / 1.18).toFixed(2) : 0;
  const igv       = montoFinal ? +(montoFinal - monto_sin).toFixed(2) : 0;

  const esEstimado = toStr(r["PROVEEDOR"]).toUpperCase() === "ESTIMADO";
  const pagadoRaw  = toStr(r[" PAGADO "] || r["PAGADO"] || "").trim().toUpperCase();
  const estado     = esEstimado ? "Estimado" : normEstado(pagadoRaw || "PENDIENTE");

  const fechaInicioISO = serialToISO(r["FECHA INICIO"]);
  const mesProg        = serialToMes(r["MES DE PROGRAMACION"] || r[" MES DE PROGRAMACION "]);

  return {
    area:          "operaciones",
    tipo:          "EGRESO",
    clasificacion: "OPEX",
    proveedor_cliente_nombre: proveedor,
    proveedor_cliente_id:     "",
    centro_costo_nombre:      normCDC(r["CDC"]),
    centro_costo_id:          null,
    categoriaNombre:          normCat(r["CATEGORIA"]),
    subcategoriaNombre:       "",
    notas:                    toStr(r["CONCEPTO"]),
    moneda,
    tc:               tc || null,
    monto_sin_igv:    monto_sin,
    igv,
    monto_total:      montoFinal,
    monto_total_pen:  moneda === "PEN" ? montoFinal : (tc ? +(montoFinal * tc).toFixed(2) : null),
    montoPresupuestado: toNum(r["PRESUPUESTADO"]) != null ? toNum(r["PRESUPUESTADO"]) : montoFinal,
    montoPagado:        null,
    detraccion:         null,
    retencion:          null,
    codigoItem:         toStr(r["CÓDIGO"] || r["CODIGO"]),
    cantidad:           toNum(r["CANTIDAD"]),
    precioUnitario:     toNum(r["PU"]),
    diasCredito:        toNum(r["DIAS DE CREDITO"] || r["DÍAS DE CRÉDITO"]),
    fechaInicio:        fechaInicioISO || "",
    metodoPago:         toStr(r["METODO DE PAGO"] || r["MÉTODO DE PAGO"]),
    mesVencimiento:     mesVenc,
    mesPagado:          null,
    mesProgramado:      mesProg,
    estado,
    postergado: /SI|YES|1|X/i.test(toStr(r["POSTERGADO"])),
    fecha:           admin.firestore.Timestamp.fromDate(new Date((fechaInicioISO || mesVenc + "-01") + "T12:00:00Z")),
    programado_fecha: null,
    fechaISO:        fechaInicioISO || mesVenc + "-01",
    creadoEn:    admin.firestore.FieldValue.serverTimestamp(),
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
    creadoPor:   "migracion-excel-2026",
    importado:   true,
    documento_tipo:   "",
    documento_numero: "",
    oc_numero: "",
    oc_id:     null,
  };
}

// ── Sincronizar centrosCosto (crear los que no existan) ───────
// CDC de cada área del Excel — se usan como ID de documento
const CDC_POR_AREA = {
  administracion: ["Gastos Oficina Central","Gastos Trabajadores","Alquiler de Socios","Honorarios Socios","Fianzas","Préstamos","Legal","Utilidad"],
  contabilidad:   ["4ta Categoría","5ta Categoría","Bravo 3","Detracción","Fraccionamiento SUNAT","IGV","ITAN","Renta 3ra Mensual","Renta Anual 2025","Retención 3%","Gastos Trabajadores"],
  ti:             ["Base de Datos","Despliegue","Equipos Tecnológicos","Hosting y Dominios","Licencias","Mantenimiento","Redes e Internet","Servicios Cloud"],
  operaciones:    ["ALMACEN","BANCOS","C-OXI","CMSELVAI","GAMAZONPNP","GCUSCOBOM","GCUSCOHIDROAMB","GCUSCOPNP","GCUZCOAMBU","GHUANUCOPNP","GICAAMB18","GICAAMB27","GLORETOAMB","GLORETOBOM","GLORETOHOSPM","GOREICAPNP","GSANMARTINAMB","GSANMARTINBOMB","INMPAN","LORETOAMB","MDI","MPCUSCOPNP","MSS","OFCENTRAL"],
};

async function sincronizarCDC() {
  const colRef = db.collection("centrosCosto");
  const snap   = await colRef.get();
  const existentes = new Set(snap.docs.map(d => d.id.toUpperCase()));
  snap.docs.forEach(d => {
    const n = (d.data().nombre || "").toUpperCase();
    if (n) existentes.add(n);
  });

  let creados = 0;
  for (const [area, cdcs] of Object.entries(CDC_POR_AREA)) {
    for (const cdc of cdcs) {
      if (!existentes.has(cdc.toUpperCase())) {
        const docId = cdc.replace(/[^a-zA-Z0-9_\-]/g, "_");
        await colRef.doc(docId).set({
          nombre:   cdc,
          codigo:   cdc,
          area,
          activo:   true,
          creadoEn: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`  + CDC creado: [${area}] ${cdc}`);
        existentes.add(cdc.toUpperCase());
        creados++;
      }
    }
  }
  console.log(`  CDC sincronizados: ${creados} creados, ${snap.size} ya existían.`);
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
  { area: "administracion", xlsx: "Flujo Administración Contabilidad TI 2026.xlsx", sheet: "BD ADMIN",      parser: (r) => parsarEstandar(r, "administracion") },
  { area: "contabilidad",   xlsx: "Flujo Administración Contabilidad TI 2026.xlsx", sheet: "BD CONTA",      parser: (r) => parsarEstandar(r, "contabilidad") },
  { area: "ti",             xlsx: "Flujo Administración Contabilidad TI 2026.xlsx", sheet: "BD TI",         parser: (r) => parsarEstandar(r, "ti") },
  { area: "operaciones",    xlsx: "Flujo de proyectos.xlsx",                        sheet: "BASE DE DATOS", parser: parsarOperaciones },
];

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀 Migracion Excel → Firestore ${DRY_RUN ? "[DRY-RUN]" : "[PRODUCCION]"}`);
  console.log(`   Proyecto: ${PROJECT_ID}  |  Coleccion: ${COL}`);
  console.log(`   Area: ${AREA_ARG}\n`);

  // Sincronizar centros de costo primero
  if (!DRY_RUN) {
    console.log("🏗️  Sincronizando centrosCosto...");
    await sincronizarCDC();
  } else {
    console.log("[DRY-RUN] Se omitiría la sincronización de centrosCosto");
  }

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
    console.log(`   Leidas: ${rows.length} | Validas: ${docs.length} | Omitidas: ${omitidos}`);
    if (docs.length > 0) {
      const n = await importarLote(docs, tarea.area);
      totalImportado += n;
    }
  }

  console.log(`\n✅ Migracion completa. Total importado: ${totalImportado} documentos.`);
  process.exit(0);
}

main().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
