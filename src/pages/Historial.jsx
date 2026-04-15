// ✅ src/pages/Historial.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ExportMenu from "../components/ExportMenu";

import { obtenerOCsPaginadas } from "../firebase/firestoreHelpers";
import { useUsuario } from "../context/UsuarioContext";
import VerOCModal from "../components/VerOCModal";
import FirmarLoteModal from "../components/FirmarLoteModal";
import { ocPendingForRole, isGerenciaRole } from "../utils/aprobaciones";
import { SkeletonTable } from "../components/ui/Skeleton";

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────
const getOrderNumber = (oc) => {
  const raw = oc?.numeroOC || oc?.numero || "";
  const m = String(raw).match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : -Infinity;
};

const normalizeStr = (v) => (v || "").toString().trim().toLowerCase();
const parseDate = (s) => {
  const t = Date.parse(s);
  return isNaN(t) ? -Infinity : t;
};

const HISTORIAL_COLS = ["numeroOC","tipoOrden","proveedor_rs","proveedor_ruc","fechaEmision","centroCosto","responsable","monedaSeleccionada","subtotal","igv","total","estado","numeroFactura","requerimiento","cotizacion"];
const HISTORIAL_HEADERS = {
  numeroOC: "N° OC", tipoOrden: "Tipo", proveedor_rs: "Proveedor", proveedor_ruc: "RUC Proveedor",
  fechaEmision: "Fecha Emisión", centroCosto: "Centro Costo", responsable: "Responsable",
  monedaSeleccionada: "Moneda", subtotal: "Subtotal", igv: "IGV", total: "Total",
  estado: "Estado", numeroFactura: "N° Factura", requerimiento: "Requerimiento", cotizacion: "Cotización",
};
const flattenOC = (oc) => ({
  ...oc,
  proveedor_rs:  oc.proveedor?.razonSocial || "",
  proveedor_ruc: oc.proveedor?.ruc || "",
  subtotal:      (oc.resumen?.subtotal != null ? Number(oc.resumen.subtotal).toFixed(2) : ""),
  igv:           (oc.resumen?.igv      != null ? Number(oc.resumen.igv     ).toFixed(2) : ""),
  total:         (oc.resumen?.total    != null ? Number(oc.resumen.total   ).toFixed(2) : ""),
  requerimiento: oc.requerimiento || oc.numeroRequerimiento || "",
  cotizacion:    oc.cotizacion    || oc.numeroCotizacion    || "",
});

const ROLES_FIRMA = ["operaciones", "gerencia operaciones", "gerencia", "gerencia general", "admin"];

// Abrevia estados largos para el badge en mobile
const estadoCorto = (estado = "") =>
  estado
    .replace("Pendiente de Gerencia Operaciones", "Pend. Ger. Op.")
    .replace("Pendiente de Gerencia General", "Pend. Ger. Gral.")
    .replace("Pendiente de Operaciones", "Pend. Operaciones")
    .replace("Pendiente de Comprador", "Pend. Comprador")
    .replace("En proceso de pago", "En pago");

const estadoBadgeClass = (estado = "") => {
  if (estado === "Pagado") return "text-green-700 bg-green-100";
  if (estado === "Aprobada" || estado === "Aprobado") return "text-blue-700 bg-blue-100";
  if (estado === "Rechazada" || estado === "Rechazado") return "text-red-700 bg-red-100";
  if (estado.startsWith("Pendiente")) return "text-amber-700 bg-amber-100";
  return "text-gray-700 bg-gray-100";
};

// Mini card para móvil
const CardOC = ({ oc, onVer, seleccionable, seleccionada, onToggle }) => (
  <div className={`bg-white border rounded-xl p-4 shadow-sm ${seleccionada ? "border-[#004990] bg-blue-50" : "border-gray-200"}`}>
    <div className="flex items-start gap-2 mb-2">
      {seleccionable && (
        <input
          type="checkbox"
          checked={seleccionada}
          onChange={onToggle}
          className="mt-0.5 h-4 w-4 accent-[#004990] flex-shrink-0"
        />
      )}
      <div className="flex-1 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-[#004990] text-base font-mono leading-tight truncate">
            {oc.numeroOC || oc.numero || "—"}
          </span>
          {oc.tieneSolicitudEdicion && (
            <span className="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700" title="Solicitud de edición pendiente">
              ✏️ Edit
            </span>
          )}
          {oc.permiteEdicion && (
            <span className="flex-shrink-0 text-xs font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700" title="Edición habilitada">
              ✔ Editar
            </span>
          )}
        </div>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${estadoBadgeClass(oc.estado || "")}`}>
          {estadoCorto(oc.estado || "—")}
        </span>
      </div>
    </div>
    <div className="text-sm text-gray-700 mb-1 leading-snug">
      {oc.proveedor?.razonSocial || "—"}
    </div>
    {(oc.resumen?.total ?? oc.total) != null && (
      <div className="text-sm font-semibold text-gray-800 mb-1 font-mono">
        {oc.monedaSeleccionada === "Dólares" ? "USD" : "S/"}{" "}
        {Number(oc.resumen?.total ?? oc.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
      </div>
    )}
    {oc.centroCosto && (
      <div className="text-xs text-gray-400 mb-1">{oc.centroCosto}</div>
    )}
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{oc.fechaEmision || "—"}</span>
      <button
        className="text-sm text-[#004990] font-semibold bg-blue-50 px-3 py-1 rounded-lg hover:bg-blue-100 transition-colors"
        onClick={onVer}
      >
        Ver →
      </button>
    </div>
  </div>
);

// ───────────────────────────────────────────────────────────────────────────────
// Componente
// ───────────────────────────────────────────────────────────────────────────────
const Historial = () => {
  const { usuario, cargando: loading } = useUsuario();
  const { search } = useLocation();
  const params = new URLSearchParams(search);

  // 👉 acepta ambas variantes para compatibilidad
  const onlyPendientesParam =
    params.get("pendientes") === "1" || params.get("bandeja") === "1";

  const [ordenes, setOrdenes]     = useState([]);
  const [lastDoc, setLastDoc]     = useState(null);
  const [hasMore, setHasMore]     = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [filtroCentroCosto, setFiltroCentroCosto] = useState("");

  // Ordenamiento (default: N° OC de mayor a menor)
  const [sortKey, setSortKey] = useState("numero");
  const [sortDir, setSortDir] = useState("desc");

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const elementosPorPagina = 15;

  // Modal
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);

  // Firma masiva
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [loteAbierto, setLoteAbierto] = useState(false);
  const puedeFireMasiva = usuario && ROLES_FIRMA.includes(String(usuario.rol || "").toLowerCase());

  // Carga inicial con paginación cursor
  useEffect(() => {
    if (!loading && usuario) {
      (async () => {
        // [F-02] Carga inicial de 30 — no 500; "Cargar más" trae el resto
        const { items, lastDoc: ld, hasMore: hm } = await obtenerOCsPaginadas(30, null);
        setOrdenes(items);
        setLastDoc(ld);
        setHasMore(hm);
      })();
    }
  }, [usuario, loading]);

  const cargarMas = async () => {
    if (!hasMore || cargandoMas) return;
    setCargandoMas(true);
    try {
      const { items, lastDoc: ld, hasMore: hm } = await obtenerOCsPaginadas(30, lastDoc);
      setOrdenes((prev) => [...prev, ...items]);
      setLastDoc(ld);
      setHasMore(hm);
    } finally {
      setCargandoMas(false);
    }
  };

  // 🔄 Escuchar actualizaciones globales de OCs (ej. desde /firmar)
  useEffect(() => {
    const handler = (e) => {
      const ocAct = e?.detail?.oc;
      if (!ocAct?.id) return;
      setOrdenes((prev) =>
        prev.map((x) => (x.id === ocAct.id ? { ...x, ...ocAct } : x))
      );
    };
    window.addEventListener("oc-updated", handler);
    return () => window.removeEventListener("oc-updated", handler);
  }, []);

  // 1) Filtro base por ROL (gerencias/finanzas: solo pendientes)
  const baseSegunRol = useMemo(() => {
    if (!usuario) return [];
    const all = ordenes || [];
    if (isGerenciaRole(usuario.rol)) {
      return all.filter((oc) => ocPendingForRole(oc, usuario.rol, usuario.email));
    }
    return all;
  }, [ordenes, usuario]);

  // 2) Si viene ?pendientes=1 (o ?bandeja=1) – fuerza pendientes para cualquier rol
  const baseConParam = useMemo(() => {
    if (!usuario) return [];
    if (onlyPendientesParam) {
      return (ordenes || []).filter((oc) => ocPendingForRole(oc, usuario.rol, usuario.email));
    }
    return baseSegunRol;
  }, [baseSegunRol, ordenes, onlyPendientesParam, usuario]);

  // 3) Filtros de UI (texto, estado, fechas, centro de costo)
  const ordenesProcesadas = useMemo(() => {
    const filtradas = (baseConParam || []).filter((oc) => {
      const q = normalizeStr(busqueda);
      const n = normalizeStr(oc.numeroOC || oc.numero);
      const p = normalizeStr(oc.proveedor?.razonSocial);
      const e = normalizeStr(oc.estado);
      const matchTexto = n.includes(q) || p.includes(q) || e.includes(q);
      const matchEstado = estadoFiltro === "Todos" || oc.estado === estadoFiltro;

      const fechaOC = oc.fechaEmision || "";
      const matchDesde = !fechaDesde || fechaOC >= fechaDesde;
      const matchHasta = !fechaHasta || fechaOC <= fechaHasta;

      const matchCC = !filtroCentroCosto ||
        normalizeStr(oc.centroCosto).includes(normalizeStr(filtroCentroCosto));

      return matchTexto && matchEstado && matchDesde && matchHasta && matchCC;
    });

    const compare = (a, b) => {
      let va, vb;
      switch (sortKey) {
        case "numero":
          va = getOrderNumber(a);
          vb = getOrderNumber(b);
          break;
        case "proveedor":
          va = normalizeStr(a.proveedor?.razonSocial);
          vb = normalizeStr(b.proveedor?.razonSocial);
          break;
        case "fecha":
          va = parseDate(a.fechaEmision);
          vb = parseDate(b.fechaEmision);
          break;
        case "estado":
          va = normalizeStr(a.estado);
          vb = normalizeStr(b.estado);
          break;
        default:
          va = 0;
          vb = 0;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      const na = getOrderNumber(a), nb = getOrderNumber(b);
      if (na < nb) return 1;
      if (na > nb) return -1;
      return 0;
    };

    return [...filtradas].sort(compare);
  }, [baseConParam, busqueda, estadoFiltro, fechaDesde, fechaHasta, filtroCentroCosto, sortKey, sortDir]);

  const totalPaginas = Math.ceil(ordenesProcesadas.length / elementosPorPagina);
  const ordenesPaginadas = ordenesProcesadas.slice(
    (paginaActual - 1) * elementosPorPagina,
    paginaActual * elementosPorPagina
  );

  const toggleDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  // callback que recibe VerOCModal al firmar/rechazar
  const handleOCActualizada = (ocActualizada) => {
    setOrdenes((prev) => prev.map((x) => (x.id === ocActualizada.id ? ocActualizada : x)));
    setOcSeleccionada(ocActualizada);
  };

  // Firma masiva helpers
  const toggleSeleccion = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleTodos = () => {
    const firmableIds = ordenesPaginadas
      .filter((oc) => ocPendingForRole(oc, usuario?.rol, usuario?.email))
      .map((oc) => oc.id);
    const todosSeleccionados = firmableIds.every((id) => seleccionados.has(id));
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosSeleccionados) firmableIds.forEach((id) => next.delete(id));
      else firmableIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const ocsSeleccionadas = ordenesProcesadas.filter((oc) => seleccionados.has(oc.id));
  const handleLoteDone = (ocsActualizadas) => {
    setOrdenes((prev) =>
      prev.map((x) => {
        const act = ocsActualizadas.find((o) => o.id === x.id);
        return act ? act : x;
      })
    );
    setSeleccionados(new Set());
  };

  if (loading) return (
    <div className="p-6 space-y-4">
      <div className="h-8 w-48 animate-pulse bg-gray-200 rounded" />
      <SkeletonTable rows={8} cols={6} />
    </div>
  );
  if (
    !usuario ||
    ![
      "admin",
      "comprador",
      "finanzas",
      "gerencia",
      "operaciones",
      "administracion",
      "legal",
      "soporte",
      "gerencia operaciones",
      "gerencia finanzas",
      "gerencia general",
    ].includes(usuario?.rol)
  ) {
    return <div className="p-6">Acceso no autorizado</div>;
  }

  const isVistaPendientesGerencia = isGerenciaRole(usuario.rol) || onlyPendientesParam;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-2 text-[#004990]">Historial de Órdenes</h2>

      {isVistaPendientesGerencia && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-700 border border-amber-200">
          Mostrando <b>solo</b> órdenes <b>pendientes</b> de tu aprobación.
        </div>
      )}

      {/* Barra flotante de firma masiva */}
      {puedeFireMasiva && seleccionados.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[#004990] text-white rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3">
          <span className="font-semibold">{seleccionados.size} seleccionada{seleccionados.size !== 1 ? "s" : ""}</span>
          <button
            onClick={() => setLoteAbierto(true)}
            className="bg-white text-[#004990] font-bold px-4 py-1.5 rounded-lg hover:bg-blue-50 text-sm"
          >
            Firmar seleccionadas
          </button>
          <button onClick={() => setSeleccionados(new Set())} className="text-white/70 hover:text-white text-lg leading-none">✕</button>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-4 space-y-2">
        {/* Búsqueda: ancho completo */}
        <input
          type="text"
          placeholder="Buscar N° OC, proveedor, estado..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
          className="w-full p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />

        {/* Estado + Centro de costo: 2 columnas */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={estadoFiltro}
            onChange={(e) => { setEstadoFiltro(e.target.value); setPaginaActual(1); }}
            className="p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          >
            <option value="Todos">Todos los estados</option>
            <option value="Pendiente de Comprador">Pend. Comprador</option>
            <option value="Pendiente de Operaciones">Pend. Operaciones</option>
            <option value="Pendiente de Gerencia General">Pend. Ger. Gral.</option>
            <option value="Aprobada">Aprobada</option>
            <option value="Rechazada">Rechazada</option>
            <option value="Pagado">Pagado</option>
            <option value="Pago Parcial">Pago Parcial</option>
          </select>

          <input
            type="text"
            placeholder="Centro de costo..."
            value={filtroCentroCosto}
            onChange={(e) => { setFiltroCentroCosto(e.target.value); setPaginaActual(1); }}
            className="p-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          />
        </div>

        {/* Fechas: 2 columnas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">Desde</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => { setFechaDesde(e.target.value); setPaginaActual(1); }}
              className="p-1.5 border rounded text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
            />
          </div>
          <div className="flex items-center gap-1">
            <label className="text-xs text-gray-500 whitespace-nowrap">Hasta</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => { setFechaHasta(e.target.value); setPaginaActual(1); }}
              className="p-1.5 border rounded text-xs w-full focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={async () => {
              setBusqueda(""); setEstadoFiltro("Todos"); setFechaDesde(""); setFechaHasta(""); setFiltroCentroCosto(""); setPaginaActual(1);
              const { items, lastDoc: ld, hasMore: hm } = await obtenerOCsPaginadas(30, null);
              setOrdenes(items); setLastDoc(ld); setHasMore(hm);
            }}
            className="text-sm text-gray-500 underline"
          >
            Limpiar
          </button>
          <ExportMenu
            data={ordenesProcesadas.map(flattenOC)}
            nombre={`historial-oc-${new Date().toISOString().slice(0,10)}`}
            titulo="Historial de Órdenes de Compra"
            columnas={HISTORIAL_COLS}
            headers={HISTORIAL_HEADERS}
          />
        </div>
      </div>

      {/* Tabla (desktop) */}
      {ordenesProcesadas.length === 0 ? (
        <p className="text-gray-600">No hay órdenes disponibles.</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border border-gray-300">
              <thead className="bg-gray-100 text-center">
                <tr>
                  {puedeFireMasiva && (
                    <th className="border px-2 py-2 w-8">
                      <input
                        type="checkbox"
                        className="accent-[#004990]"
                        onChange={toggleTodos}
                        checked={
                          ordenesPaginadas
                            .filter((oc) => ocPendingForRole(oc, usuario?.rol, usuario?.email))
                            .every((oc) => seleccionados.has(oc.id)) &&
                          ordenesPaginadas.some((oc) => ocPendingForRole(oc, usuario?.rol, usuario?.email))
                        }
                      />
                    </th>
                  )}
                  <th
                    className="border px-3 py-2 cursor-pointer"
                    onClick={() => {
                      setSortKey("numero");
                      toggleDir();
                      setPaginaActual(1);
                    }}
                  >
                    N° OC
                  </th>
                  <th
                    className="border px-3 py-2 cursor-pointer"
                    onClick={() => {
                      setSortKey("proveedor");
                      toggleDir();
                      setPaginaActual(1);
                    }}
                  >
                    Proveedor
                  </th>
                  <th
                    className="border px-3 py-2 cursor-pointer"
                    onClick={() => {
                      setSortKey("fecha");
                      toggleDir();
                      setPaginaActual(1);
                    }}
                  >
                    Fecha
                  </th>
                  <th
                    className="border px-3 py-2 cursor-pointer"
                    onClick={() => {
                      setSortKey("estado");
                      toggleDir();
                      setPaginaActual(1);
                    }}
                  >
                    Estado
                  </th>
                  <th className="border px-3 py-2 text-right">Monto</th>
                  <th className="border px-3 py-2">Centro Costo</th>
                  <th className="border px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map((oc) => {
                  const esFirmable = ocPendingForRole(oc, usuario?.rol, usuario?.email);
                  const total = oc.resumen?.total ?? oc.total ?? null;
                  const simbolo = oc.monedaSeleccionada === "Dólares" ? "USD" : "S/";
                  return (
                  <tr key={oc.id} className={`text-center border-t ${seleccionados.has(oc.id) ? "bg-blue-50" : ""}`}>
                    {puedeFireMasiva && (
                      <td className="border px-2 py-2">
                        {esFirmable && (
                          <input
                            type="checkbox"
                            className="accent-[#004990]"
                            checked={seleccionados.has(oc.id)}
                            onChange={() => toggleSeleccion(oc.id)}
                          />
                        )}
                      </td>
                    )}
                    <td className="border px-3 py-2 font-semibold">
                      <div className="flex flex-col items-start gap-0.5">
                        <span>{oc.numeroOC || oc.numero}</span>
                        {oc.tieneSolicitudEdicion && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-normal">✏️ Solicitud edición</span>
                        )}
                        {oc.permiteEdicion && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-normal">✔ Edición habilitada</span>
                        )}
                      </div>
                    </td>
                    <td className="border px-3 py-2">
                      {oc.proveedor?.razonSocial || "—"}
                    </td>
                    <td className="border px-3 py-2">{oc.fechaEmision || "—"}</td>
                    <td className="border px-3 py-2">
                      <span
                        className={`font-medium px-2 py-1 rounded-full text-xs ${
                          oc.estado === "Pagado"
                            ? "text-green-700 bg-green-100"
                            : oc.estado === "Rechazado" || oc.estado === "Rechazada"
                            ? "text-red-700 bg-red-100"
                            : oc.estado?.includes("Aprobad")
                            ? "text-blue-700 bg-blue-100"
                            : "text-amber-700 bg-amber-100"
                        }`}
                      >
                        {estadoCorto(oc.estado || "—")}
                      </span>
                    </td>
                    <td className="border px-3 py-2 text-right font-mono text-sm whitespace-nowrap">
                      {total != null ? `${simbolo} ${Number(total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : "—"}
                    </td>
                    <td className="border px-3 py-2 text-xs text-left">
                      {oc.centroCosto || "—"}
                    </td>
                    <td className="border px-3 py-2">
                      <div className="flex flex-wrap justify-center gap-3">
                        <button
                          className="text-blue-600 underline"
                          onClick={() => {
                            setOcSeleccionada(oc);
                            setModalAbierto(true);
                          }}
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards (móvil) */}
          <div className="grid md:hidden gap-3">
            {ordenesPaginadas.map((oc) => {
              const esFirmable = puedeFireMasiva && ocPendingForRole(oc, usuario?.rol, usuario?.email);
              return (
                <CardOC
                  key={oc.id}
                  oc={oc}
                  onVer={() => {
                    setOcSeleccionada(oc);
                    setModalAbierto(true);
                  }}
                  seleccionable={esFirmable}
                  seleccionada={seleccionados.has(oc.id)}
                  onToggle={() => toggleSeleccion(oc.id)}
                />
              );
            })}
          </div>

          {/* Paginación: ventana deslizante de máx. 5 botones + anterior/siguiente */}
          {totalPaginas > 1 && (
            <div className="flex justify-center items-center mt-4 gap-1 flex-wrap">
              <button
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                disabled={paginaActual === 1}
                className="px-2 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
              >‹</button>
              {(() => {
                const win = 5;
                let start = Math.max(1, paginaActual - Math.floor(win / 2));
                let end = Math.min(totalPaginas, start + win - 1);
                if (end - start < win - 1) start = Math.max(1, end - win + 1);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPaginaActual(p)}
                    className={`px-3 py-1 border rounded text-sm ${
                      p === paginaActual
                        ? "bg-[#004990] text-white border-[#004990]"
                        : "bg-white text-[#004990] border-[#004990] hover:bg-blue-50"
                    }`}
                  >
                    {p}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaActual === totalPaginas}
                className="px-2 py-1 border rounded text-sm disabled:opacity-40 hover:bg-gray-100"
              >›</button>
              <span className="text-xs text-gray-400 ml-1">{paginaActual}/{totalPaginas}</span>
            </div>
          )}

          {/* Cargar más desde Firestore */}
          {hasMore && (
            <div className="flex justify-center mt-3">
              <button
                onClick={cargarMas}
                disabled={cargandoMas}
                className="px-5 py-2 border border-[#004990] text-[#004990] rounded hover:bg-[#004990] hover:text-white text-sm transition-colors disabled:opacity-50"
              >
                {cargandoMas ? "Cargando…" : `Cargar más (${ordenes.length} cargadas)`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Ver OC */}
      {modalAbierto && ocSeleccionada && (
        <VerOCModal
          oc={ocSeleccionada}
          onClose={() => setModalAbierto(false)}
          onUpdated={handleOCActualizada}
        />
      )}

      {/* Modal Firma Masiva */}
      {loteAbierto && ocsSeleccionadas.length > 0 && (
        <FirmarLoteModal
          ocs={ocsSeleccionadas}
          onClose={() => setLoteAbierto(false)}
          onDone={handleLoteDone}
        />
      )}
    </div>
  );
};

export default Historial;
