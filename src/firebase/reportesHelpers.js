// ✅ src/firebase/reportesHelpers.js
import { db } from "./config";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

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
