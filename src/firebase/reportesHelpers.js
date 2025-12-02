// ✅ src/firebase/reportesHelpers.js
import { db } from "./config";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { obtenerTransaccionesFinancieras } from "./finanzasHelpers";

/* ───────── Helpers fechas ───────── */

const startOfDay = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d;
};

/* ───────── Normalizadores de campos Firestore ───────── */

// Proveedor → siempre string
function normalizarProveedorNombre(d) {
  if (typeof d.proveedorNombre === "string" && d.proveedorNombre.trim()) {
    return d.proveedorNombre.trim();
  }
  if (typeof d.proveedor === "string" && d.proveedor.trim()) {
    return d.proveedor.trim();
  }
  if (d.proveedor && typeof d.proveedor === "object") {
    if (
      typeof d.proveedor.razonSocial === "string" &&
      d.proveedor.razonSocial.trim()
    ) {
      return d.proveedor.razonSocial.trim();
    }
    if (typeof d.proveedor.nombre === "string" && d.proveedor.nombre.trim()) {
      return d.proveedor.nombre.trim();
    }
    if (typeof d.proveedor.ruc === "string" && d.proveedor.ruc.trim()) {
      return `Proveedor ${d.proveedor.ruc.trim()}`;
    }
  }
  return "Sin proveedor";
}

// Proveedor RUC → string o vacío
function normalizarProveedorRuc(d) {
  if (typeof d.proveedorRuc === "string" && d.proveedorRuc.trim()) {
    return d.proveedorRuc.trim();
  }
  if (d.proveedor && typeof d.proveedor === "object") {
    if (typeof d.proveedor.ruc === "string" && d.proveedor.ruc.trim()) {
      return d.proveedor.ruc.trim();
    }
  }
  return "";
}

// Centro de costo → siempre string
function normalizarCentroCostoNombre(d) {
  if (typeof d.centroCostoNombre === "string" && d.centroCostoNombre.trim()) {
    return d.centroCostoNombre.trim();
  }
  if (typeof d.centroCosto === "string" && d.centroCosto.trim()) {
    return d.centroCosto.trim();
  }
  if (d.centroCosto && typeof d.centroCosto === "object") {
    if (
      typeof d.centroCosto.nombre === "string" &&
      d.centroCosto.nombre.trim()
    ) {
      return d.centroCosto.nombre.trim();
    }
    if (
      typeof d.centroCosto.descripcion === "string" &&
      d.centroCosto.descripcion.trim()
    ) {
      return d.centroCosto.descripcion.trim();
    }
    if (
      typeof d.centroCosto.codigo === "string" &&
      d.centroCosto.codigo.trim()
    ) {
      return d.centroCosto.codigo.trim();
    }
  }
  return "Sin centro de costo";
}

// Fecha para agrupar
function normalizarFechaOC(d) {
  let fecha = null;

  if (typeof d.fechaEmision === "string" && d.fechaEmision.length >= 10) {
    fecha = new Date(d.fechaEmision + "T00:00:00");
  } else if (d.creadaEn?.toDate) {
    fecha = d.creadaEn.toDate();
  }

  if (fecha instanceof Date && !isNaN(fecha.getTime())) {
    return fecha;
  }
  return null;
}

// Tipo de orden (compra, servicio, interna, etc.)
function normalizarTipoOrden(d) {
  const raw =
    d.tipoOrden ||
    d.tipoOC ||
    d.tipoOrdenCompra ||
    d.tipo ||
    ""; // defensivo

  const t = String(raw || "").toLowerCase();

  if (t.includes("serv")) return "Servicio";
  if (t.includes("intern")) return "Interna";
  if (t.includes("compra") || t === "oc" || t === "orden") return "Compra";

  return raw ? String(raw) : "Sin tipo";
}

// Montos por moneda:
// - moneda registrada en la OC (PEN / USD)
// - base = montoTotalConIGV / totalConIGV / montoTotal / monto
// - si es USD y hay tipoCambio / tc → convertimos a PEN para global
function calcularMontosPorMoneda(d) {
  const moneda = (d.moneda || "PEN").toUpperCase();
  const base =
    Number(
      d.montoTotalConIGV ??
        d.totalConIGV ??
        d.montoTotal ??
        d.monto ??
        0
    ) || 0;

  let montoPen = 0;
  let montoUsd = 0;

  if (moneda === "USD") {
    montoUsd = base;
    const tc =
      Number(d.tipoCambio || d.tc || d.tcRef || d.tcOc || 0) || 0;
    if (tc > 0) {
      montoPen = base * tc;
    } else {
      // si no hay TC, lo dejamos en 0 en PEN global
      montoPen = 0;
    }
  } else {
    // asumimos PEN como default
    montoPen = base;
  }

  return { montoPen, montoUsd };
}

/* ───────── Dashboard General ───────── */

/**
 * Dashboard General — indicadores principales OC.
 *
 * Campos usados de ordenesCompra:
 *  - creadaEn (Timestamp)
 *  - fechaEmision (string "YYYY-MM-DD", opcional)
 *  - estado
 *  - centroCosto / centroCostoNombre / centroCosto (objeto)
 *  - proveedor / proveedorNombre / proveedor (objeto)
 *  - proveedorRuc / proveedor.ruc
 *  - numeroOC / correlativo / codigo
 *  - moneda (PEN / USD)
 *  - tipoOrden / tipoOC / tipo
 *  - montoTotalConIGV / totalConIGV / montoTotal / monto
 *  - tipoCambio / tc / tcRef (para USD → PEN)
 */
export async function obtenerIndicadoresDashboardGeneral(filtros = {}) {
  const {
    fechaDesde,
    fechaHasta,
    centro_costo_id = "",
    proyecto_id = "",
    proveedor_ruc = "",
  } = filtros;

  const desde = startOfDay(fechaDesde);
  const hasta = endOfDay(fechaHasta);

  let q = query(collection(db, "ordenesCompra"));

  if (desde) {
    q = query(q, where("creadaEn", ">=", desde));
  }
  if (hasta) {
    q = query(q, where("creadaEn", "<=", hasta));
  }
  if (centro_costo_id) {
    q = query(q, where("centroCostoId", "==", centro_costo_id));
  }
  if (proyecto_id) {
    q = query(q, where("proyectoId", "==", proyecto_id));
  }
  if (proveedor_ruc) {
    q = query(q, where("proveedorRuc", "==", proveedor_ruc));
  }

  const snap = await getDocs(q);

  let totalOC = 0;
  let totalMontoPen = 0;
  let totalMontoUsd = 0;

  const porEstadoMap = new Map();
  const porTipoOrdenMap = new Map();
  const proveedoresMap = new Map(); // nombre → { pen, usd }
  const centrosCostoMap = new Map(); // nombre → { pen, usd }
  const porMesMap = new Map(); // key "YYYY-MM" → { pen, usd }

  let sumaHorasAprob = 0;
  let cuentaAprob = 0;

  const ultimasOC = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;

    totalOC += 1;

    // 🔹 Montos por moneda
    const { montoPen, montoUsd } = calcularMontosPorMoneda(d);
    totalMontoPen += montoPen;
    totalMontoUsd += montoUsd;

    const estado = d.estado || "Sin estado";
    porEstadoMap.set(estado, (porEstadoMap.get(estado) || 0) + 1);

    // 🔹 Tipo de orden (compra, servicio, interna)
    const tipoOrden = normalizarTipoOrden(d);
    const prevTipo = porTipoOrdenMap.get(tipoOrden) || {
      cantidad: 0,
      montoPen: 0,
      montoUsd: 0,
    };
    porTipoOrdenMap.set(tipoOrden, {
      cantidad: prevTipo.cantidad + 1,
      montoPen: prevTipo.montoPen + montoPen,
      montoUsd: prevTipo.montoUsd + montoUsd,
    });

    // 🔹 Proveedor
    const provNombre = normalizarProveedorNombre(d);
    const provRuc = normalizarProveedorRuc(d);

    const prevProv = proveedoresMap.get(provNombre) || {
      pen: 0,
      usd: 0,
    };
    proveedoresMap.set(provNombre, {
      pen: prevProv.pen + montoPen,
      usd: prevProv.usd + montoUsd,
      ruc: provRuc || prevProv.ruc || "",
    });

    // 🔹 Centro de costo
    const ccNombre = normalizarCentroCostoNombre(d);
    const prevCc = centrosCostoMap.get(ccNombre) || {
      pen: 0,
      usd: 0,
    };
    centrosCostoMap.set(ccNombre, {
      pen: prevCc.pen + montoPen,
      usd: prevCc.usd + montoUsd,
    });

    // 🔹 Fecha para agrupación mensual
    const fecha = normalizarFechaOC(d);
    let fechaISO = "";

    if (fecha) {
      fechaISO = fecha.toISOString().slice(0, 10);
      const y = fecha.getFullYear();
      const m = fecha.getMonth() + 1;
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const prevMes = porMesMap.get(key) || {
        pen: 0,
        usd: 0,
      };
      porMesMap.set(key, {
        pen: prevMes.pen + montoPen,
        usd: prevMes.usd + montoUsd,
      });
    } else if (typeof d.fechaEmision === "string") {
      fechaISO = d.fechaEmision;
    }

    // 🔹 Tiempo promedio de aprobación (si existen campos)
    if (d.creadaEn?.toDate && d.fechaAprobacionGerencia?.toDate) {
      const f1 = d.creadaEn.toDate();
      const f2 = d.fechaAprobacionGerencia.toDate();
      const diffHoras = (f2.getTime() - f1.getTime()) / 1000 / 3600;
      if (diffHoras > 0) {
        sumaHorasAprob += diffHoras;
        cuentaAprob += 1;
      }
    }

    // 🔹 N° OC
    const numeroOC =
      d.numeroOC || d.correlativo || d.codigo || id;

    // Fila normalizada
    ultimasOC.push({
      id,
      numeroOC,
      proveedor: provNombre,
      proveedorRuc: provRuc,
      centroCosto: ccNombre,
      estado,
      fechaISO,
      moneda: (d.moneda || "PEN").toUpperCase(),
      totalPen: montoPen,
      totalUsd: montoUsd,
      totalGlobalPen: montoPen + montoUsd, // si USD sin TC → 0
      tipoOrden,
    });
  });

  // Ordenar últimas OCs
  ultimasOC.sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));
  const ultimasOC10 = ultimasOC.slice(0, 10);

  // Map → arrays
  const porEstado = Array.from(porEstadoMap.entries()).map(
    ([estado, cantidad]) => ({ estado, cantidad })
  );

  const porTipoOrden = Array.from(porTipoOrdenMap.entries()).map(
    ([tipoOrden, info]) => ({
      tipoOrden,
      cantidad: info.cantidad,
      totalPen: info.montoPen,
      totalUsd: info.montoUsd,
      totalGlobalPen: info.montoPen + info.montoUsd,
    })
  );

  const rankingProveedores = Array.from(proveedoresMap.entries())
    .map(([nombre, info]) => ({
      nombre,
      ruc: info.ruc || "",
      totalPen: info.pen,
      totalUsd: info.usd,
      totalGlobalPen: info.pen + info.usd,
    }))
    .sort((a, b) => b.totalGlobalPen - a.totalGlobalPen)
    .slice(0, 8);

  const rankingCentrosCosto = Array.from(centrosCostoMap.entries())
    .map(([nombre, info]) => ({
      nombre,
      totalPen: info.pen,
      totalUsd: info.usd,
      totalGlobalPen: info.pen + info.usd,
    }))
    .sort((a, b) => b.totalGlobalPen - a.totalGlobalPen)
    .slice(0, 8);

  const comprasMensuales = Array.from(porMesMap.entries())
    .map(([key, info]) => {
      const [year, month] = key.split("-");
      const label = `${month}/${year}`;
      const pen = info.pen;
      const usd = info.usd;
      return {
        key,
        anio: Number(year),
        mes: Number(month),
        label,
        totalPen: pen,
        totalUsd: usd,
        totalGlobalPen: pen + usd,
      };
    })
    .sort((a, b) =>
      a.anio === b.anio ? a.mes - b.mes : a.anio - b.anio
    );

  const tiempoPromedioHoras =
    cuentaAprob > 0 ? +(sumaHorasAprob / cuentaAprob).toFixed(1) : null;

  const totalGlobalPen = totalMontoPen + totalMontoUsd;

  return {
    resumenOC: {
      totalOC,
      totalMontoPen,
      totalMontoUsd,
      totalGlobalPen,
      porEstado,
      porTipoOrden,
      tiempoPromedioHoras,
    },
    comprasMensuales,
    rankingProveedores,
    rankingCentrosCosto,
    ultimasOC: ultimasOC10,
  };
}


// ──────────────────────────────────────────────
// Dashboard Caja Chica
// ──────────────────────────────────────────────

/**
 * Indicadores de Caja Chica.
 *
 * Estructura esperada (ajusta si tus campos son distintos):
 *  - colección: cajasChicas
 *    - docId: "operaciones", "administracion", "proyectos", etc.
 *    - subcolección: movimientos
 *        - tipo: "INGRESO" | "EGRESO"
 *        - moneda: "PEN" | "USD" (default PEN)
 *        - monto: number
 *        - fecha: Timestamp (o campo fechaISO "YYYY-MM-DD")
 *        - centroCostoNombre (opcional)
 *        - descripcion (opcional)
 *        - creadoPor / creadoPorNombre (opcional)
 */
export async function obtenerIndicadoresCajaChica(filtros = {}) {
  const {
    fechaDesde,
    fechaHasta,
    cajaId = "", // "" = todas
    centro_costo_id = "",
  } = filtros;

  const desde = startOfDay(fechaDesde);
  const hasta = endOfDay(fechaHasta);

  const cajasRef = collection(db, "cajasChicas");
  const cajasSnap = await getDocs(cajasRef);

  // Acumuladores globales
  let ingresosPen = 0;
  let egresosPen = 0;
  let ingresosUsd = 0;
  let egresosUsd = 0;

  // Mapas auxiliares
  const porCajaMap = new Map();         // key: cajaId → { ingresosPen, egresosPen, ingresosUsd, egresosUsd }
  const porCentroCostoMap = new Map();  // key: nombre → { pen, usd }
  const porMesMap = new Map();          // key "YYYY-MM" → { pen, usd }

  const ultimosMovs = [];

  for (const cajaDoc of cajasSnap.docs) {
    const cajaDocId = cajaDoc.id;

    if (cajaId && cajaId !== cajaDocId) continue; // filtro por caja específica

    const movsRef = collection(db, `cajasChicas/${cajaDocId}/movimientos`);
    const movsSnap = await getDocs(movsRef);

    for (const movDoc of movsSnap.docs) {
      const m = movDoc.data();
      const id = movDoc.id;

      // Filtro por fechas
      let fecha = null;
      if (m.fecha?.toDate) {
        fecha = m.fecha.toDate();
      } else if (typeof m.fechaISO === "string" && m.fechaISO.length >= 10) {
        fecha = new Date(m.fechaISO + "T00:00:00");
      }
      if (!fecha || isNaN(fecha.getTime())) continue;

      if (desde && fecha < desde) continue;
      if (hasta && fecha > hasta) continue;

      // Filtro por CC si aplicara por id (si tienes centroCostoId en movimientos, ajusta aquí)
      if (centro_costo_id && m.centroCostoId && m.centroCostoId !== centro_costo_id) {
        continue;
      }

      const fechaISO = fecha.toISOString().slice(0, 10);
      const year = fecha.getFullYear();
      const month = fecha.getMonth() + 1;
      const mesKey = `${year}-${String(month).padStart(2, "0")}`;

      const tipo = String(m.tipo || "").toUpperCase();
      const moneda = (m.moneda || "PEN").toUpperCase();
      const monto = Number(m.monto ?? 0) || 0;
      if (!monto) continue;

      // Acumuladores globales por moneda
      if (moneda === "USD") {
        if (tipo === "INGRESO") ingresosUsd += monto;
        else if (tipo === "EGRESO") egresosUsd += monto;
      } else {
        if (tipo === "INGRESO") ingresosPen += monto;
        else if (tipo === "EGRESO") egresosPen += monto;
      }

      // Por caja
      const cajaEntry = porCajaMap.get(cajaDocId) || {
        cajaId: cajaDocId,
        ingresosPen: 0,
        egresosPen: 0,
        ingresosUsd: 0,
        egresosUsd: 0,
      };
      if (moneda === "USD") {
        if (tipo === "INGRESO") cajaEntry.ingresosUsd += monto;
        else if (tipo === "EGRESO") cajaEntry.egresosUsd += monto;
      } else {
        if (tipo === "INGRESO") cajaEntry.ingresosPen += monto;
        else if (tipo === "EGRESO") cajaEntry.egresosPen += monto;
      }
      porCajaMap.set(cajaDocId, cajaEntry);

      // Por centro de costo (nombre)
      const ccNombre =
        (m.centroCostoNombre && String(m.centroCostoNombre).trim()) ||
        (m.centroCosto && String(m.centroCosto).trim()) ||
        "Sin centro de costo";

      const ccEntry = porCentroCostoMap.get(ccNombre) || {
        nombre: ccNombre,
        pen: 0,
        usd: 0,
      };
      if (moneda === "USD") {
        ccEntry.usd += tipo === "INGRESO" ? monto : -monto;
      } else {
        ccEntry.pen += tipo === "INGRESO" ? monto : -monto;
      }
      porCentroCostoMap.set(ccNombre, ccEntry);

      // Por mes + moneda (consideramos solo egresos para análisis de gasto; ajusta si quieres ambos)
      const mesEntry = porMesMap.get(mesKey) || {
        key: mesKey,
        anio: year,
        mes: month,
        label: `${month}/${year}`,
        pen: 0,
        usd: 0,
      };
      if (moneda === "USD") {
        mesEntry.usd += tipo === "EGRESO" ? monto : 0;
      } else {
        mesEntry.pen += tipo === "EGRESO" ? monto : 0;
      }
      porMesMap.set(mesKey, mesEntry);

      // Ultimos movimientos (guardamos y luego ordenamos)
      ultimosMovs.push({
        id,
        cajaId: cajaDocId,
        tipo,
        moneda,
        monto,
        fechaISO,
        centroCosto: ccNombre,
        descripcion: m.descripcion || "",
        creadoPor: m.creadoPorNombre || m.creadoPor || "",
      });
    }
  }

  const saldoPen = ingresosPen - egresosPen;
  const saldoUsd = ingresosUsd - egresosUsd;

  // Ordenar últimos movimientos por fecha desc
  ultimosMovs.sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));
  const ultimosMovs20 = ultimosMovs.slice(0, 20);

  const resumenCajaChica = {
    ingresosPen,
    egresosPen,
    saldoPen,
    ingresosUsd,
    egresosUsd,
    saldoUsd,
    totalMovimientos: ultimosMovs.length,
  };

  const porCaja = Array.from(porCajaMap.values()).map((c) => ({
    ...c,
    saldoPen: c.ingresosPen - c.egresosPen,
    saldoUsd: c.ingresosUsd - c.egresosUsd,
  }));

  const rankingCentrosCosto = Array.from(porCentroCostoMap.values())
    .map((cc) => ({
      ...cc,
      saldoGlobal: cc.pen + cc.usd, // solo referencia, ajusta si usas TC
    }))
    .sort((a, b) => Math.abs(b.saldoGlobal) - Math.abs(a.saldoGlobal))
    .slice(0, 8);

  const egresosMensuales = Array.from(porMesMap.values()).sort((a, b) =>
    a.anio === b.anio ? a.mes - b.mes : a.anio - b.anio
  );

  return {
    resumenCajaChica,
    porCaja,
    rankingCentrosCosto,
    egresosMensuales,
    ultimosMovs: ultimosMovs20,
  };
}

// ──────────────────────────────────────────────
// Dashboard Finanzas (Flujos Financieros)
// ──────────────────────────────────────────────

/**
 * Indicadores de Finanzas (Flujos Financieros).
 *
 * Reutiliza obtenerTransaccionesFinancieras() que ya usas en FlujosFinancieros.jsx
 * Campos usados de cada transacción:
 *  - tipo: "INGRESO" | "EGRESO"
 *  - clasificacion: "OPEX" | "CAPEX"
 *  - moneda: "PEN" | "USD"
 *  - monto_total_pen (preferente) o monto_total
 *  - fechaISO (string "YYYY-MM-DD") o fecha (Date/Timestamp)
 *  - categoriaNombre, subcategoriaNombre
 *  - centro_costo_nombre
 *  - forma_pago
 *  - estado
 *  - documento_tipo, documento_numero
 *  - oc_numero
 */
export async function obtenerIndicadoresFinanzas(filtros = {}) {
  const {
    fechaDesde,
    fechaHasta,
    centro_costo_id = "",
    categoriaId = "",
    tipo = "",          // "INGRESO" | "EGRESO" (opcional)
    clasificacion = "", // "OPEX" | "CAPEX" (opcional)
  } = filtros;

  // Reutilizamos tu helper: ya aplica filtros de fechas, tipo, estado, categoría, centro de costo, etc.
  const { transacciones = [] } = await obtenerTransaccionesFinancieras({
    fechaDesde: fechaDesde || null,
    fechaHasta: fechaHasta || null,
    tipo: tipo || null,
    estado: null,
    categoriaId: categoriaId || null,
    centro_costo_id: centro_costo_id || null,
  });

  let ingresosPen = 0;
  let egresosPen = 0;
  let ingresosUsd = 0;
  let egresosUsd = 0;

  let capexPen = 0;
  let opexPen = 0;
  let capexUsd = 0;
  let opexUsd = 0;

  const porMesPen = new Map(); // key "YYYY-MM" → { ingresos, egresos, neto }
  const porMesUsd = new Map();

  const porCategoriaMap = new Map();     // categoriaNombre → { pen, usd }
  const porCentroCostoMap = new Map();   // centro_costo_nombre → { pen, usd }
  const porFormaPagoMap = new Map();     // forma_pago → { pen, usd }

  const ultimas = [];

  for (const t of transacciones) {
    const tipoTx = String(t.tipo || "").toUpperCase();
    const clasif = String(t.clasificacion || "").toUpperCase();
    const moneda = (t.moneda || "PEN").toUpperCase();

    // Monto base: priorizamos monto_total_pen, luego monto_total, luego monto_sin_igv
    const montoBase =
      Number(
        t.monto_total_pen ??
          t.monto_total ??
          t.monto_sin_igv ??
          0
      ) || 0;
    if (!montoBase) continue;

    // Fecha para agrupación mensual
    let fecha = null;
    if (typeof t.fechaISO === "string" && t.fechaISO.length >= 10) {
      fecha = new Date(t.fechaISO + "T00:00:00");
    } else if (t.fecha?.toDate) {
      fecha = t.fecha.toDate();
    } else if (t.fecha instanceof Date) {
      fecha = t.fecha;
    }

    let fechaISO = "";
    let mesKey = "";

    if (fecha && !isNaN(fecha.getTime())) {
      fechaISO = fecha.toISOString().slice(0, 10);
      const y = fecha.getFullYear();
      const m = fecha.getMonth() + 1;
      mesKey = `${y}-${String(m).padStart(2, "0")}`;
    }

    // Acumuladores PEN / USD
    const signo = tipoTx === "INGRESO" ? 1 : -1;
    if (moneda === "USD") {
      if (tipoTx === "INGRESO") ingresosUsd += montoBase;
      if (tipoTx === "EGRESO") egresosUsd += montoBase;
    } else {
      if (tipoTx === "INGRESO") ingresosPen += montoBase;
      if (tipoTx === "EGRESO") egresosPen += montoBase;
    }

    // CAPEX / OPEX por moneda
    if (clasif === "CAPEX") {
      if (moneda === "USD") capexUsd += montoBase * signo;
      else capexPen += montoBase * signo;
    } else if (clasif === "OPEX") {
      if (moneda === "USD") opexUsd += montoBase * signo;
      else opexPen += montoBase * signo;
    }

    // Flujo mensual PEN / USD
    if (mesKey) {
      if (moneda === "USD") {
        const entry = porMesUsd.get(mesKey) || {
          key: mesKey,
          ingresos: 0,
          egresos: 0,
        };
        if (tipoTx === "INGRESO") entry.ingresos += montoBase;
        if (tipoTx === "EGRESO") entry.egresos += montoBase;
        porMesUsd.set(mesKey, entry);
      } else {
        const entry = porMesPen.get(mesKey) || {
          key: mesKey,
          ingresos: 0,
          egresos: 0,
        };
        if (tipoTx === "INGRESO") entry.ingresos += montoBase;
        if (tipoTx === "EGRESO") entry.egresos += montoBase;
        porMesPen.set(mesKey, entry);
      }
    }

    // Categoría
    const catNombre =
      (t.categoriaNombre && String(t.categoriaNombre).trim()) ||
      "Sin categoría";
    const catEntry = porCategoriaMap.get(catNombre) || {
      categoria: catNombre,
      pen: 0,
      usd: 0,
    };
    if (moneda === "USD") {
      catEntry.usd += montoBase * signo;
    } else {
      catEntry.pen += montoBase * signo;
    }
    porCategoriaMap.set(catNombre, catEntry);

    // Centro de costo
    const ccNombre =
      (t.centro_costo_nombre &&
        String(t.centro_costo_nombre).trim()) ||
      (t.centroCostoNombre &&
        String(t.centroCostoNombre).trim()) ||
      "Sin centro de costo";
    const ccEntry = porCentroCostoMap.get(ccNombre) || {
      centroCosto: ccNombre,
      pen: 0,
      usd: 0,
    };
    if (moneda === "USD") {
      ccEntry.usd += montoBase * signo;
    } else {
      ccEntry.pen += montoBase * signo;
    }
    porCentroCostoMap.set(ccNombre, ccEntry);

    // Forma de pago
    const formaPago =
      (t.forma_pago && String(t.forma_pago).trim()) ||
      "Sin forma de pago";
    const fpEntry = porFormaPagoMap.get(formaPago) || {
      formaPago,
      pen: 0,
      usd: 0,
    };
    if (moneda === "USD") {
      fpEntry.usd += montoBase * signo;
    } else {
      fpEntry.pen += montoBase * signo;
    }
    porFormaPagoMap.set(formaPago, fpEntry);

    // Fila normalizada para "últimas"
    ultimas.push({
      id: t.id,
      fechaISO,
      tipo: tipoTx,
      clasificacion: clasif,
      moneda,
      monto: montoBase * signo,
      categoria: catNombre,
      centroCosto: ccNombre,
      formaPago,
      estado: t.estado || "",
      documento: t.documento_tipo
        ? `${t.documento_tipo} ${t.documento_numero || ""}`.trim()
        : t.documento_numero || "",
      ocNumero: t.oc_numero || t.ordenNumero || "",
      notas: t.notas || "",
    });
  }

  const netoPen = ingresosPen - egresosPen;
  const netoUsd = ingresosUsd - egresosUsd;

  // Ordenar mensuales
  const flujoMensualPen = Array.from(porMesPen.values())
    .map((m) => {
      const [year, month] = m.key.split("-");
      const neto = m.ingresos - m.egresos;
      return {
        ...m,
        anio: Number(year),
        mes: Number(month),
        label: `${month}/${year}`,
        neto,
      };
    })
    .sort((a, b) =>
      a.anio === b.anio ? a.mes - b.mes : a.anio - b.anio
    );

  const flujoMensualUsd = Array.from(porMesUsd.values())
    .map((m) => {
      const [year, month] = m.key.split("-");
      const neto = m.ingresos - m.egresos;
      return {
        ...m,
        anio: Number(year),
        mes: Number(month),
        label: `${month}/${year}`,
        neto,
      };
    })
    .sort((a, b) =>
      a.anio === b.anio ? a.mes - b.mes : a.anio - b.anio
    );

  const porCategoria = Array.from(porCategoriaMap.values()).map((c) => ({
    ...c,
    netoGlobal: c.pen + c.usd, // referencia sin TC
  }));

  const rankingCategorias = [...porCategoria]
    .sort((a, b) => Math.abs(b.netoGlobal) - Math.abs(a.netoGlobal))
    .slice(0, 10);

  const porCentroCosto = Array.from(porCentroCostoMap.values()).map((c) => ({
    ...c,
    netoGlobal: c.pen + c.usd,
  }));

  const rankingCentrosCosto = [...porCentroCosto]
    .sort((a, b) => Math.abs(b.netoGlobal) - Math.abs(a.netoGlobal))
    .slice(0, 10);

  const porFormaPago = Array.from(porFormaPagoMap.values()).map((f) => ({
    ...f,
    netoGlobal: f.pen + f.usd,
  }));

  // Últimas transacciones: ordenar por fecha desc
  ultimas.sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));
  const ultimas20 = ultimas.slice(0, 20);

  const resumenFinanzas = {
    ingresosPen,
    egresosPen,
    netoPen,
    ingresosUsd,
    egresosUsd,
    netoUsd,
    capexPen,
    opexPen,
    capexUsd,
    opexUsd,
    totalTransacciones: transacciones.length,
  };

  return {
    resumenFinanzas,
    flujoMensualPen,
    flujoMensualUsd,
    rankingCategorias,
    rankingCentrosCosto,
    porFormaPago,
    ultimas: ultimas20,
  };
}


// ──────────────────────────────────────────────
// Dashboard Compras
// ──────────────────────────────────────────────

export async function obtenerIndicadoresCompras(filtros = {}) {
  const {
    fechaDesde,
    fechaHasta,
    centro_costo_id = "",
    proveedor_ruc = "",
    tipo_oc = "", // compra | servicio | interna
  } = filtros;

  const desde = fechaDesde ? new Date(fechaDesde + "T00:00:00") : null;
  const hasta = fechaHasta ? new Date(fechaHasta + "T23:59:59") : null;

  let q = query(collection(db, "ordenesCompra"));

  // fechas
  if (desde) q = query(q, where("creadaEn", ">=", desde));
  if (hasta) q = query(q, where("creadaEn", "<=", hasta));

  // filtros opcionales
  if (centro_costo_id) q = query(q, where("centroCostoId", "==", centro_costo_id));
  if (proveedor_ruc) q = query(q, where("proveedorRuc", "==", proveedor_ruc));
  if (tipo_oc) q = query(q, where("tipoOC", "==", tipo_oc));

  const snap = await getDocs(q);

  // Acumuladores
  let compraPen = 0, compraUsd = 0;
  let servicioPen = 0, servicioUsd = 0;
  let internaPen = 0, internaUsd = 0;

  let totalPen = 0, totalUsd = 0;

  const porEstado = new Map();
  const porTipo = new Map();
  const porMes = new Map();
  const rankingProv = new Map();
  const rankingCC = new Map();
  const ultimas = [];

  snap.forEach((docSnap) => {
    const d = docSnap.data();
    const id = docSnap.id;

    const tipo = (d.tipoOC || "compra").toLowerCase();
    const moneda = (d.moneda || "PEN").toUpperCase();
    const estado = d.estado || "Sin estado";

    const monto =
      Number(
        d.montoTotalConIGV ??
        d.totalConIGV ??
        d.montoTotal ??
        d.monto ??
        0
      ) || 0;

    // Acumulador moneda/tipo
    if (tipo === "compra") {
      if (moneda === "USD") compraUsd += monto;
      else compraPen += monto;
    } else if (tipo === "servicio") {
      if (moneda === "USD") servicioUsd += monto;
      else servicioPen += monto;
    } else if (tipo === "interna") {
      if (moneda === "USD") internaUsd += monto;
      else internaPen += monto;
    }

    // Totales por moneda
    if (moneda === "USD") totalUsd += monto;
    else totalPen += monto;

    // Estados
    porEstado.set(estado, (porEstado.get(estado) || 0) + 1);

    // Tipos
    porTipo.set(tipo, (porTipo.get(tipo) || 0) + monto);

    // Ranking proveedor
    const prov = normalizarProveedorNombre(d);
    rankingProv.set(prov, (rankingProv.get(prov) || 0) + monto);

    // Ranking centro costo
    const cc = normalizarCentroCostoNombre(d);
    rankingCC.set(cc, (rankingCC.get(cc) || 0) + monto);

    // Fecha
    const fecha = normalizarFechaOC(d);
    let fechaISO = "";
    let keyMes = "";
    if (fecha) {
      fechaISO = fecha.toISOString().slice(0, 10);
      const y = fecha.getFullYear();
      const m = fecha.getMonth() + 1;
      keyMes = `${y}-${String(m).padStart(2, "0")}`;
      porMes.set(keyMes, (porMes.get(keyMes) || 0) + monto);
    }

    // Últimas
    ultimas.push({
      id,
      numeroOC: d.numeroOC || d.correlativo || d.codigo || id,
      fechaISO,
      proveedor: prov,
      centroCosto: cc,
      tipo,
      moneda,
      estado,
      total: monto,
    });
  });

  // Ordenar últimas
  ultimas.sort((a, b) => (b.fechaISO || "").localeCompare(a.fechaISO || ""));
  const ultimas20 = ultimas.slice(0, 20);

  // Maps → arrays
  const rankingProveedores = Array.from(rankingProv.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const rankingCentrosCosto = Array.from(rankingCC.entries())
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const comprasMensuales = Array.from(porMes.entries())
    .map(([key, total]) => {
      const [y, m] = key.split("-");
      return {
        key,
        anio: Number(y),
        mes: Number(m),
        label: `${m}/${y}`,
        total,
      };
    })
    .sort((a, b) =>
      a.anio === b.anio ? a.mes - b.mes : a.anio - b.anio
    );

  return {
    totales: {
      compraPen,
      compraUsd,
      servicioPen,
      servicioUsd,
      internaPen,
      internaUsd,
      totalPen,
      totalUsd,
    },
    porEstado: Array.from(porEstado.entries()).map(([estado, cantidad]) => ({
      estado,
      cantidad,
    })),
    porTipo: Array.from(porTipo.entries()).map(([tipo, total]) => ({
      tipo,
      total,
    })),
    comprasMensuales,
    rankingProveedores,
    rankingCentrosCosto,
    ultimas: ultimas20,
  };
}
