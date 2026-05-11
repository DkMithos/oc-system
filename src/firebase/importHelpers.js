// src/firebase/importHelpers.js
// Mapeo de columnas Excel → Firestore para las dos variantes de Flujo Financiero:
//   - Esquema "Estándar"  (Admin / Contabilidad / TI)
//   - Esquema "Operaciones" (Proyectos / CDC — más columnas)
// Escribe en la colección `transaccionesFinancieras` con campo `area` para filtrado.

import * as XLSX from "xlsx";
import { collection, writeBatch, doc, Timestamp, serverTimestamp } from "firebase/firestore";
import { db } from "./config";

const COL = "transaccionesFinancieras";

// ── Utilidades ────────────────────────────────────────────────

// Convierte serial Excel (ej. 46143) o string ISO a "YYYY-MM-DD"
function parsearFecha(raw) {
  if (!raw) return "";
  if (typeof raw === "number") {
    try {
      return XLSX.SSF.format("yyyy-mm-dd", raw);
    } catch {
      // fallback manual
      const base = new Date(1899, 11, 30);
      base.setDate(base.getDate() + Math.floor(raw));
      return base.toISOString().slice(0, 10);
    }
  }
  const s = String(raw).trim();
  // Formatos: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/");
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-");
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  return s.slice(0, 10);
}

function parsearMes(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // "Enero 2025", "ENE-25", etc. — normalizar
  const meses = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
    jan:1,apr:4,aug:8,dec:12 };
  const m = s.toLowerCase().match(/([a-z]+)[^\d]*(\d{2,4})/);
  if (m) {
    const num = meses[m[1].slice(0,3)];
    if (num) {
      const year = m[2].length === 2 ? `20${m[2]}` : m[2];
      return `${year}-${String(num).padStart(2,"0")}`;
    }
  }
  return null;
}

function toNum(v) { const n = Number(String(v || "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? null : n; }
function toStr(v) { return String(v || "").trim(); }
const toTimestamp = (iso) => iso ? Timestamp.fromDate(new Date(iso)) : null;

// Normaliza el nombre de una columna para matching flexible
function normCol(s) { return String(s || "").trim().toLowerCase().replace(/[^a-z0-9]/g, ""); }

function resolverCol(row, aliases) {
  for (const alias of aliases) {
    const key = Object.keys(row).find((k) => normCol(k) === normCol(alias));
    if (key !== undefined && row[key] !== undefined && row[key] !== "") return row[key];
  }
  return "";
}

// ── Esquema Estándar (Admin / Contabilidad / TI) ──────────────
const COL_ESTANDAR = {
  fecha:             ["fecha", "date", "fecha doc", "fecha documento"],
  concepto:          ["concepto", "detalle", "descripcion", "descripción", "glosa"],
  categoria:         ["categoria", "categoría"],
  proveedor:         ["proveedor", "razon social", "razón social", "nombre proveedor"],
  ruc:               ["ruc", "ruc proveedor", "nro ruc"],
  tipoDoc:           ["tipo doc", "tipo documento", "tipo comprobante", "tipo"],
  nroDoc:            ["nro doc", "n° doc", "numero documento", "serie-correlativo", "documento"],
  montoSin:          ["monto sin igv", "monto base", "base imponible", "monto s/ sin igv"],
  montoEjecutado:    ["monto ejecutado"],
  montoPresupuestado:["monto presupuestado"],
  montoPagado:       ["monto pagado"],
  monto_soles:       ["monto s/", "monto soles", "importe s/", "total soles", "s/"],
  monto_dolares:     ["monto $", "monto usd", "importe $", "total usd", "$", "usd"],
  igv:               ["igv", "i.g.v.", "igv s/"],
  total:             ["total", "importe total", "monto total", "total s/"],
  detraccion:        ["detraccion", "detracción", "detraccion s/"],
  retencion:         ["retencion", "retención"],
  mesVencimiento:    ["mes vencimiento", "mes", "mes pago", "vencimiento"],
  mesProgramado:     ["mes programado"],
  estado:            ["estado", "estado pago", "pagado", "pagado/pendiente"],
  metodoPago:        ["metodo pago", "método pago", "forma pago", "forma de pago"],
  nroOC:             ["n° oc", "nro oc", "orden compra", "oc"],
  postergado:        ["postergado", "pospuesto"],
  notas:             ["notas", "observaciones", "observacion", "comentarios"],
  momento:           ["momento"],
  centroCosto:       ["cdc", "centro costo", "cc", "centro de costo", "proyecto"],
  moneda:            ["moneda"],
  tc:                ["tc", "tipo cambio", "tipo de cambio"],
  areaExcel:         ["área", "area"],
};

export function parsearFilaEstandar(row, idx) {
  const rc = (aliases) => resolverCol(row, aliases);

  const fechaISO = parsearFecha(rc(COL_ESTANDAR.fecha));

  // Moneda: detectar por campo MONEDA o por presencia de columnas $
  const monedaRaw = toStr(rc(COL_ESTANDAR.moneda));
  const montoS = toNum(rc(COL_ESTANDAR.monto_soles)) || toNum(rc(COL_ESTANDAR.total)) || toNum(rc(COL_ESTANDAR.montoSin));
  const montoUSD = toNum(rc(COL_ESTANDAR.monto_dolares));
  const montoEjecutado = toNum(rc(COL_ESTANDAR.montoEjecutado));
  const montoPresup = toNum(rc(COL_ESTANDAR.montoPresupuestado));
  const montoPagado = toNum(rc(COL_ESTANDAR.montoPagado));

  // Resolver moneda: "$" o "USD" → USD, resto → PEN
  const moneda = /\$|usd/i.test(monedaRaw) ? "USD"
               : (montoUSD && !montoS ? "USD" : "PEN");

  const tc = toNum(rc(COL_ESTANDAR.tc)) || null;

  // Monto total: prioridad MONTO EJECUTADO > total > monto_soles > monto_dolares > montoSin
  const monto_total_raw = montoEjecutado || toNum(rc(COL_ESTANDAR.total)) || montoS || montoUSD
                        || toNum(rc(COL_ESTANDAR.montoSin)) || 0;
  const monto_total = Math.abs(monto_total_raw);

  const igv = Math.abs(toNum(rc(COL_ESTANDAR.igv)) || 0);
  const monto_sin_igv = toNum(rc(COL_ESTANDAR.montoSin)) || (igv ? monto_total - igv : +(monto_total / 1.18).toFixed(2));

  // monto_total_pen: si es PEN directo, si es USD y hay TC → convertir
  let monto_total_pen = null;
  if (moneda === "PEN") {
    monto_total_pen = +monto_total.toFixed(2);
  } else if (tc && tc > 0) {
    monto_total_pen = +(monto_total * tc).toFixed(2);
  }

  // Estado: PAGADO, PENDIENTE, etc
  const estadoRaw = toStr(rc(COL_ESTANDAR.estado));
  const estado = /pagado/i.test(estadoRaw) ? "Pagado"
               : /pendiente/i.test(estadoRaw) ? "Pendiente"
               : estadoRaw || "";

  // Postergado: puede ser número (0/1) o texto
  const postergadoRaw = rc(COL_ESTANDAR.postergado);
  const postergado = postergadoRaw === 1 || /si|yes|x|1/i.test(toStr(postergadoRaw));

  const errores = [];
  if (!monto_total) errores.push("Monto vacio");

  // Combinar notas + momento
  const notas = [toStr(rc(COL_ESTANDAR.notas)), toStr(rc(COL_ESTANDAR.momento))].filter(Boolean).join(" | ");

  return {
    _fila: idx + 2,
    _valida: errores.length === 0,
    _errores: errores,
    fecha:                fechaISO || "",
    fechaISO:             fechaISO || "",
    tipo:                 "EGRESO",
    clasificacion:        "OPEX",
    moneda,
    tc,
    monto_sin_igv:        +Math.abs(monto_sin_igv).toFixed(2),
    igv:                  +igv.toFixed(2),
    monto_total:          +monto_total.toFixed(2),
    monto_total_pen:      monto_total_pen,
    montoPresupuestado:   montoPresup ? +Math.abs(montoPresup).toFixed(2) : null,
    montoPagado:          montoPagado ? +Math.abs(montoPagado).toFixed(2) : null,
    proveedor_cliente_nombre: toStr(rc(COL_ESTANDAR.proveedor)),
    proveedor_cliente_id:     toStr(rc(COL_ESTANDAR.ruc)),
    documento_tipo:           toStr(rc(COL_ESTANDAR.tipoDoc)),
    documento_numero:         toStr(rc(COL_ESTANDAR.nroDoc)),
    oc_numero:                toStr(rc(COL_ESTANDAR.nroOC)),
    centro_costo_nombre:      toStr(rc(COL_ESTANDAR.centroCosto)),
    estado,
    metodoPago:               toStr(rc(COL_ESTANDAR.metodoPago)),
    detraccion:               toNum(rc(COL_ESTANDAR.detraccion)),
    retencion:                toNum(rc(COL_ESTANDAR.retencion)),
    mesVencimiento:           parsearMes(rc(COL_ESTANDAR.mesVencimiento)),
    mesProgramado:            parsearMes(rc(COL_ESTANDAR.mesProgramado)),
    postergado,
    notas,
    categoriaNombre:          toStr(rc(COL_ESTANDAR.categoria)) || toStr(rc(COL_ESTANDAR.concepto)),
    subcategoriaNombre:       toStr(rc(COL_ESTANDAR.categoria)) ? toStr(rc(COL_ESTANDAR.concepto)) : "",
  };
}

// ── Esquema Operaciones (CDC / Proyectos) ─────────────────────
const COL_OPER = {
  codigo:         ["codigo", "código", "cod", "item"],
  proveedor:      ["proveedor", "razon social", "razón social"],
  ruc:            ["ruc", "nro ruc"],
  descripcion:    ["concepto", "descripcion", "descripción", "detalle", "servicio"],
  categoria:      ["categoria", "categoría"],
  cantidad:       ["cantidad", "cant.", "cant"],
  precioUnitario: ["pu", "p.u.", "precio unitario", "precio unit"],
  montoEjecutado: ["monto ejecutado"],
  montoPresupuestado: ["monto presupuestado"],
  montoPagado:    ["monto pagado"],
  monto_soles:    ["total s/", "total soles", "monto s/", "importe s/", "s/", "total"],
  monto_dolares:  ["total $", "monto $", "importe $", "$"],
  detraccion:     ["detraccion", "detracción", "detraccion s/"],
  retencion:      ["retencion", "retención"],
  importeNeto:    ["importe neto", "neto", "neto a pagar"],
  diasCredito:    ["dias credito", "días crédito", "dias de credito", "plazo"],
  fechaInicio:    ["fecha inicio", "fecha emision", "fecha doc", "fecha"],
  mesVencimiento: ["mes vencimiento", "mes", "mes pago", "vencimiento"],
  mesProgramado:  ["mes programado"],
  metodoPago:     ["metodo pago", "método pago", "forma pago", "metodo de pago"],
  nroOC:          ["n° oc", "nro oc", "oc", "orden compra"],
  estado:         ["estado", "estado pago", "pagado", "pagado/pendiente"],
  notas:          ["notas", "observaciones"],
  centroCosto:    ["cdc", "centro costo", "cc", "proyecto", "centro de costo"],
  moneda:         ["moneda"],
  tc:             ["tc", "tipo cambio", "tipo de cambio"],
  postergado:     ["postergado", "pospuesto"],
  areaExcel:      ["área", "area"],
};

export function parsearFilaOperaciones(row, idx) {
  const rc = (aliases) => resolverCol(row, aliases);

  const fechaISO = parsearFecha(rc(COL_OPER.fechaInicio));
  const cantidad = toNum(rc(COL_OPER.cantidad));
  const pu = toNum(rc(COL_OPER.precioUnitario));
  const montoEjecutado = toNum(rc(COL_OPER.montoEjecutado));
  const montoPresup = toNum(rc(COL_OPER.montoPresupuestado));
  const montoPagado = toNum(rc(COL_OPER.montoPagado));
  const montoS = toNum(rc(COL_OPER.monto_soles));
  const montoUSD = toNum(rc(COL_OPER.monto_dolares));

  // Moneda: detectar por campo MONEDA o por columnas
  const monedaRaw = toStr(rc(COL_OPER.moneda));
  const moneda = /\$|usd/i.test(monedaRaw) ? "USD"
               : (montoUSD && !montoS && !montoEjecutado ? "USD" : "PEN");

  const tc = toNum(rc(COL_OPER.tc)) || null;

  // Monto: MONTO EJECUTADO > total_soles > total_usd > cantidad*PU
  const monto_total_raw = montoEjecutado || montoS || montoUSD
                        || (cantidad && pu ? +(cantidad * pu).toFixed(2) : 0);
  const monto_total = Math.abs(monto_total_raw);

  // monto_total_pen
  let monto_total_pen = null;
  if (moneda === "PEN") {
    monto_total_pen = +monto_total.toFixed(2);
  } else if (tc && tc > 0) {
    monto_total_pen = +(monto_total * tc).toFixed(2);
  }

  // Estado
  const estadoRaw = toStr(rc(COL_OPER.estado));
  const estado = /pagado/i.test(estadoRaw) ? "Pagado"
               : /pendiente/i.test(estadoRaw) ? "Pendiente"
               : estadoRaw || "";

  // Postergado
  const postergadoRaw = rc(COL_OPER.postergado);
  const postergado = postergadoRaw === 1 || /si|yes|x|1/i.test(toStr(postergadoRaw));

  const errores = [];
  if (!monto_total) errores.push("Monto vacio");

  return {
    _fila: idx + 2,
    _valida: errores.length === 0,
    _errores: errores,
    fecha:                fechaISO || "",
    fechaISO:             fechaISO || "",
    tipo:                 "EGRESO",
    clasificacion:        "OPEX",
    moneda,
    tc,
    monto_sin_igv:        +(monto_total / 1.18).toFixed(2),
    igv:                  +(monto_total - monto_total / 1.18).toFixed(2),
    monto_total:          +monto_total.toFixed(2),
    monto_total_pen:      monto_total_pen,
    montoPresupuestado:   montoPresup ? +Math.abs(montoPresup).toFixed(2) : null,
    montoPagado:          montoPagado ? +Math.abs(montoPagado).toFixed(2) : null,
    codigoItem:           toStr(rc(COL_OPER.codigo)),
    proveedor_cliente_nombre: toStr(rc(COL_OPER.proveedor)),
    proveedor_cliente_id:     toStr(rc(COL_OPER.ruc)),
    categoriaNombre:          toStr(rc(COL_OPER.categoria)) || toStr(rc(COL_OPER.descripcion)),
    subcategoriaNombre:       toStr(rc(COL_OPER.categoria)) ? toStr(rc(COL_OPER.descripcion)) : "",
    notas:                    toStr(rc(COL_OPER.notas)),
    cantidad:                 cantidad,
    precioUnitario:           pu,
    diasCredito:              toNum(rc(COL_OPER.diasCredito)),
    fechaInicio:              fechaISO,
    detraccion:               toNum(rc(COL_OPER.detraccion)),
    retencion:                toNum(rc(COL_OPER.retencion)),
    importeNeto:              toNum(rc(COL_OPER.importeNeto)),
    mesVencimiento:           parsearMes(rc(COL_OPER.mesVencimiento)),
    mesProgramado:            parsearMes(rc(COL_OPER.mesProgramado)),
    metodoPago:               toStr(rc(COL_OPER.metodoPago)),
    oc_numero:                toStr(rc(COL_OPER.nroOC)),
    estado,
    postergado,
    centro_costo_nombre:      toStr(rc(COL_OPER.centroCosto)),
    documento_tipo:           "",
    documento_numero:         "",
  };
}

// ── Leer archivo Excel → array de objetos ─────────────────────

/** Lee un archivo Excel y devuelve { sheetNames, rows } de la hoja indicada (default: primera). */
export function leerExcel(file, sheetName = null) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const nombre = sheetName || wb.SheetNames[0];
        const sheet = wb.Sheets[nombre];
        if (!sheet) {
          reject(new Error("Hoja '" + nombre + "' no encontrada en el archivo."));
          return;
        }
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve({ sheetNames: wb.SheetNames, rows, selectedSheet: nombre });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/** Solo lee los nombres de las hojas de un archivo Excel. */
export function leerHojasExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false, sheetStubs: true });
        const info = wb.SheetNames.map((name) => {
          const ws = wb.Sheets[name];
          const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
          const filas = range ? range.e.r - range.s.r : 0;
          return { name, filas };
        });
        resolve(info);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ── Batch write a Firestore ───────────────────────────────────
const CHUNK = 400; // margen seguro < 500

export async function importarTransacciones(filas, area, emailUsuario) {
  const validas = filas.filter((f) => f._valida);
  if (!validas.length) throw new Error("No hay filas válidas para importar.");

  const colRef = collection(db, COL);
  let importadas = 0;

  for (let i = 0; i < validas.length; i += CHUNK) {
    const batch = writeBatch(db);
    const chunk = validas.slice(i, i + CHUNK);

    for (const fila of chunk) {
      const { _fila, _valida, _errores, ...data } = fila;
      const docRef = doc(colRef);
      const fechaTs = data.fechaISO ? toTimestamp(data.fechaISO) : Timestamp.now();

      batch.set(docRef, {
        ...data,
        area,
        fecha: fechaTs,
        programado_fecha: null,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
        creadoPor: emailUsuario || "",
        importado: true,
      });
    }

    await batch.commit();
    importadas += chunk.length;
  }

  return importadas;
}
