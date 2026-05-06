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
  proveedor:         ["proveedor", "razon social", "razón social", "nombre proveedor"],
  ruc:               ["ruc", "ruc proveedor", "nro ruc"],
  tipoDoc:           ["tipo doc", "tipo documento", "tipo comprobante"],
  nroDoc:            ["nro doc", "n° doc", "numero documento", "serie-correlativo", "documento"],
  montoSin:          ["monto sin igv", "monto base", "base imponible", "monto s/ sin igv"],
  monto_soles:       ["monto s/", "monto soles", "importe s/", "total soles", "s/"],
  monto_dolares:     ["monto $", "monto usd", "importe $", "total usd", "$", "usd"],
  igv:               ["igv", "i.g.v.", "igv s/"],
  total:             ["total", "importe total", "monto total", "total s/"],
  detraccion:        ["detraccion", "detracción", "detraccion s/"],
  retencion:         ["retencion", "retención"],
  mesVencimiento:    ["mes vencimiento", "mes", "mes pago", "vencimiento"],
  estado:            ["estado", "estado pago"],
  metodoPago:        ["metodo pago", "método pago", "forma pago", "forma de pago"],
  nroOC:             ["n° oc", "nro oc", "orden compra", "oc"],
  postergado:        ["postergado", "pospuesto"],
  notas:             ["notas", "observaciones", "observacion", "comentarios"],
  centroCosto:       ["centro costo", "cc", "centro de costo", "proyecto"],
};

export function parsearFilaEstandar(row, idx) {
  const rc = (aliases) => resolverCol(row, aliases);

  const fechaISO = parsearFecha(rc(COL_ESTANDAR.fecha));
  const montoS = toNum(rc(COL_ESTANDAR.monto_soles)) || toNum(rc(COL_ESTANDAR.total)) || toNum(rc(COL_ESTANDAR.montoSin));
  const montoUSD = toNum(rc(COL_ESTANDAR.monto_dolares));
  const moneda = montoUSD && !montoS ? "USD" : "PEN";
  const monto_sin_igv = toNum(rc(COL_ESTANDAR.montoSin)) || (moneda === "PEN" ? montoS : montoUSD) || 0;
  const igv = toNum(rc(COL_ESTANDAR.igv)) || 0;
  const monto_total = toNum(rc(COL_ESTANDAR.total)) || (monto_sin_igv + igv) || montoS || montoUSD || 0;

  const errores = [];
  if (!fechaISO) errores.push("Fecha inválida");
  if (!monto_total) errores.push("Monto vacío");

  return {
    _fila: idx + 2,
    _valida: errores.length === 0,
    _errores: errores,
    fecha:                fechaISO,
    fechaISO,
    tipo:                 "EGRESO",
    clasificacion:        "OPEX",
    moneda,
    monto_sin_igv:        +monto_sin_igv.toFixed(2),
    igv:                  +igv.toFixed(2),
    monto_total:          +monto_total.toFixed(2),
    monto_total_pen:      moneda === "PEN" ? +monto_total.toFixed(2) : null,
    proveedor_cliente_nombre: toStr(rc(COL_ESTANDAR.proveedor)),
    proveedor_cliente_id:     toStr(rc(COL_ESTANDAR.ruc)),
    documento_tipo:           toStr(rc(COL_ESTANDAR.tipoDoc)),
    documento_numero:         toStr(rc(COL_ESTANDAR.nroDoc)),
    oc_numero:                toStr(rc(COL_ESTANDAR.nroOC)),
    centro_costo_nombre:      toStr(rc(COL_ESTANDAR.centroCosto)),
    estado:                   toStr(rc(COL_ESTANDAR.estado)),
    metodoPago:               toStr(rc(COL_ESTANDAR.metodoPago)),
    detraccion:               toNum(rc(COL_ESTANDAR.detraccion)),
    retencion:                toNum(rc(COL_ESTANDAR.retencion)),
    mesVencimiento:           parsearMes(rc(COL_ESTANDAR.mesVencimiento)),
    postergado:               /si|yes|x|1/i.test(toStr(rc(COL_ESTANDAR.postergado))),
    notas:                    toStr(rc(COL_ESTANDAR.notas)),
    categoriaNombre:          toStr(rc(COL_ESTANDAR.concepto)),
  };
}

// ── Esquema Operaciones (CDC / Proyectos) ─────────────────────
const COL_OPER = {
  codigo:         ["codigo", "código", "cod", "item"],
  proveedor:      ["proveedor", "razon social", "razón social"],
  ruc:            ["ruc", "nro ruc"],
  descripcion:    ["descripcion", "descripción", "concepto", "detalle", "servicio"],
  cantidad:       ["cantidad", "cant.", "cant"],
  precioUnitario: ["pu", "p.u.", "precio unitario", "precio unit"],
  monto_soles:    ["total s/", "total soles", "monto s/", "importe s/", "s/"],
  monto_dolares:  ["total $", "monto $", "importe $", "$"],
  detraccion:     ["detraccion", "detracción", "detraccion s/"],
  retencion:      ["retencion", "retención"],
  importeNeto:    ["importe neto", "neto", "neto a pagar"],
  diasCredito:    ["dias credito", "días crédito", "dias de credito", "plazo"],
  fechaInicio:    ["fecha inicio", "fecha emision", "fecha doc", "fecha"],
  mesVencimiento: ["mes vencimiento", "mes", "mes pago", "vencimiento"],
  metodoPago:     ["metodo pago", "método pago", "forma pago"],
  nroOC:         ["n° oc", "nro oc", "oc", "orden compra"],
  estado:         ["estado", "estado pago"],
  notas:          ["notas", "observaciones"],
  centroCosto:    ["centro costo", "cc", "proyecto", "centro de costo"],
};

export function parsearFilaOperaciones(row, idx) {
  const rc = (aliases) => resolverCol(row, aliases);

  const fechaISO = parsearFecha(rc(COL_OPER.fechaInicio));
  const cantidad = toNum(rc(COL_OPER.cantidad));
  const pu = toNum(rc(COL_OPER.precioUnitario));
  const montoS = toNum(rc(COL_OPER.monto_soles));
  const montoUSD = toNum(rc(COL_OPER.monto_dolares));
  const moneda = montoUSD && !montoS ? "USD" : "PEN";
  const monto_total = montoS || montoUSD || (cantidad && pu ? +(cantidad * pu).toFixed(2) : 0);

  const errores = [];
  if (!monto_total) errores.push("Monto vacío");

  return {
    _fila: idx + 2,
    _valida: errores.length === 0,
    _errores: errores,
    fecha:                fechaISO || "",
    fechaISO:             fechaISO || "",
    tipo:                 "EGRESO",
    clasificacion:        "OPEX",
    moneda,
    monto_sin_igv:        +(monto_total / 1.18).toFixed(2),
    igv:                  +(monto_total - monto_total / 1.18).toFixed(2),
    monto_total:          +monto_total.toFixed(2),
    monto_total_pen:      moneda === "PEN" ? +monto_total.toFixed(2) : null,
    codigoItem:           toStr(rc(COL_OPER.codigo)),
    proveedor_cliente_nombre: toStr(rc(COL_OPER.proveedor)),
    proveedor_cliente_id:     toStr(rc(COL_OPER.ruc)),
    categoriaNombre:          toStr(rc(COL_OPER.descripcion)),
    notas:                    toStr(rc(COL_OPER.notas)),
    cantidad:                 cantidad,
    precioUnitario:           pu,
    diasCredito:              toNum(rc(COL_OPER.diasCredito)),
    fechaInicio:              fechaISO,
    detraccion:               toNum(rc(COL_OPER.detraccion)),
    retencion:                toNum(rc(COL_OPER.retencion)),
    importeNeto:              toNum(rc(COL_OPER.importeNeto)),
    mesVencimiento:           parsearMes(rc(COL_OPER.mesVencimiento)),
    metodoPago:               toStr(rc(COL_OPER.metodoPago)),
    oc_numero:                toStr(rc(COL_OPER.nroOC)),
    estado:                   toStr(rc(COL_OPER.estado)),
    centro_costo_nombre:      toStr(rc(COL_OPER.centroCosto)),
    documento_tipo:           "",
    documento_numero:         "",
  };
}

// ── Leer archivo Excel → array de objetos ─────────────────────
export function leerExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        resolve(rows);
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
