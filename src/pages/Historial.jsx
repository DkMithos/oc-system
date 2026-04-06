// ✅ src/pages/Historial.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import ExportMenu from "../components/ExportMenu";

import { obtenerOCsPaginadas } from "../firebase/firestoreHelpers";
import { useUsuario } from "../context/UsuarioContext";
import VerOCModal from "../components/VerOCModal";
import { ocPendingForRole, isGerenciaRole } from "../utils/aprobaciones";

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
  subtotal: oc.resumen?.subtotal?.toFixed(2) || "",
  igv:      oc.resumen?.igv?.toFixed(2) || "",
  total:    oc.resumen?.total?.toFixed(2) || "",
});

// Mini card para móvil
const CardOC = ({ oc, onVer }) => (
  <div className="bg-white border rounded-lg p-3 shadow-sm">
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-500">N° OC</div>
      <div className="text-sm font-semibold">{oc.numeroOC || oc.numero || "—"}</div>
    </div>
    <div className="mt-2">
      <div className="text-xs text-gray-500">Proveedor</div>
      <div className="text-sm">{oc.proveedor?.razonSocial || "—"}</div>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-3">
      <div>
        <div className="text-xs text-gray-500">Fecha</div>
        <div className="text-sm">{oc.fechaEmision || "—"}</div>
      </div>
      <div>
        <div className="text-xs text-gray-500">Estado</div>
        <span
          className={`inline-block mt-0.5 text-xs font-medium px-2 py-1 rounded-full ${
            oc.estado === "Pagado"
              ? "text-green-700 bg-green-100"
              : oc.estado === "Aprobada"
              ? "text-blue-700 bg-blue-100"
              : (oc.estado === "Rechazada" || oc.estado === "Rechazado")
              ? "text-red-700 bg-red-100"
              : oc.estado?.startsWith("Pendiente")
              ? "text-amber-700 bg-amber-100"
              : "text-gray-700 bg-gray-100"
          }`}
        >
          {oc.estado || "—"}
        </span>
      </div>
    </div>
    <div className="mt-3 flex justify-end">
      <button className="text-[#004990] font-medium underline" onClick={onVer}>
        Ver
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

  // Carga inicial con paginación cursor
  useEffect(() => {
    if (!loading && usuario) {
      (async () => {
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

  if (loading) return <div className="p-6">Cargando usuario…</div>;
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

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar N° OC, proveedor, estado..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />

        <select
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value); setPaginaActual(1); }}
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        >
          <option value="Todos">Todos los estados</option>
          <option value="Pendiente de Comprador">Pendiente de Comprador</option>
          <option value="Pendiente de Operaciones">Pendiente de Operaciones</option>
          <option value="Pendiente de Gerencia General">Pendiente de Gerencia General</option>
          <option value="Aprobada">Aprobada</option>
          <option value="Rechazada">Rechazada</option>
          <option value="Pagado">Pagado</option>
        </select>

        <input
          type="text"
          placeholder="Filtrar por centro de costo..."
          value={filtroCentroCosto}
          onChange={(e) => { setFiltroCentroCosto(e.target.value); setPaginaActual(1); }}
          className="p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
        />

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Desde:</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={(e) => { setFechaDesde(e.target.value); setPaginaActual(1); }}
            className="p-2 border rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Hasta:</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={(e) => { setFechaHasta(e.target.value); setPaginaActual(1); }}
            className="p-2 border rounded text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#fbc102]"
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => { setBusqueda(""); setEstadoFiltro("Todos"); setFechaDesde(""); setFechaHasta(""); setFiltroCentroCosto(""); setPaginaActual(1); }}
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
                  <th className="border px-3 py-2">Factura</th>
                  <th className="border px-3 py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ordenesPaginadas.map((oc) => (
                  <tr key={oc.id} className="text-center border-t">
                    <td className="border px-3 py-2 font-semibold">
                      {oc.numeroOC || oc.numero}
                    </td>
                    <td className="border px-3 py-2">
                      {oc.proveedor?.razonSocial || "—"}
                    </td>
                    <td className="border px-3 py-2">{oc.fechaEmision || "—"}</td>
                    <td className="border px-3 py-2">
                      <span
                        className={`font-medium px-2 py-1 rounded-full ${
                          oc.estado === "Pagado"
                            ? "text-green-700 bg-green-100"
                            : oc.estado === "Rechazado"
                            ? "text-red-700 bg-red-100"
                            : oc.estado?.includes("Aprobado")
                            ? "text-blue-700 bg-blue-100"
                            : "text-gray-700 bg-gray-100"
                        }`}
                      >
                        {oc.estado}
                      </span>
                    </td>
                    <td className="border px-3 py-2 text-xs">
                      {oc.estado === "Pagado" && oc.numeroFactura ? oc.numeroFactura : "—"}
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
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards (móvil) */}
          <div className="grid md:hidden gap-3">
            {ordenesPaginadas.map((oc) => (
              <CardOC
                key={oc.id}
                oc={oc}
                onVer={() => {
                  setOcSeleccionada(oc);
                  setModalAbierto(true);
                }}
              />
            ))}
          </div>

          {/* Paginación de páginas */}
          <div className="flex justify-center mt-4 gap-2 flex-wrap">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <button
                key={i}
                className={`px-3 py-1 border rounded ${
                  i + 1 === paginaActual
                    ? "bg-[#004990] text-white"
                    : "bg-white text-[#004990] border-[#004990]"
                }`}
                onClick={() => setPaginaActual(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>

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
    </div>
  );
};

export default Historial;
