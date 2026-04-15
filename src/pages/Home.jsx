// src/pages/Home.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUsuario } from "../context/UsuarioContext";
import { usePendientes } from "../context/PendientesContext";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { obtenerTodasOC } from "../firebase/dashboardHelpers";
import {
  listarSolicitudesPendientesGlobal,
  listarSolicitudesPorEmail,
} from "../firebase/solicitudesHelpers";

// ── Accesos rápidos por rol ──────────────────────────────────
const ACCESOS_POR_ROL = {
  admin: [
    { label: "Historial OCs",    path: "/historial",     color: "bg-[#004990]" },
    { label: "Panel Admin",      path: "/admin",         color: "bg-gray-700"  },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-blue-600"  },
    { label: "Logs",             path: "/logs",          color: "bg-red-600"   },
    { label: "Maestros",         path: "/cargar-maestros", color: "bg-purple-600" },
    { label: "Exportaciones",    path: "/exportaciones", color: "bg-green-600" },
  ],
  comprador: [
    { label: "Nueva OC",         path: "/crear",         color: "bg-[#004990]" },
    { label: "Requerimientos",   path: "/requerimientos",color: "bg-blue-600"  },
    { label: "Cotizaciones",     path: "/cotizaciones",  color: "bg-indigo-600"},
    { label: "Mis OCs",          path: "/historial",     color: "bg-gray-600"  },
    { label: "Proveedores",      path: "/proveedores",   color: "bg-teal-600"  },
  ],
  operaciones: [
    { label: "Pendientes",       path: "/historial?bandeja=1", color: "bg-amber-600" },
    { label: "Historial OCs",   path: "/historial",     color: "bg-[#004990]" },
    { label: "Caja Chica",       path: "/caja",          color: "bg-green-600" },
    { label: "Requerimientos",   path: "/requerimientos",color: "bg-blue-600"  },
  ],
  "gerencia operaciones": [
    { label: "Pendientes",       path: "/historial?bandeja=1", color: "bg-amber-600" },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-[#004990]" },
    { label: "Caja Chica",       path: "/caja",          color: "bg-green-600" },
    { label: "Indicadores",      path: "/indicadores",   color: "bg-blue-600"  },
  ],
  "gerencia general": [
    { label: "Pendientes",       path: "/historial?bandeja=1", color: "bg-amber-600" },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-[#004990]" },
    { label: "Indicadores",      path: "/indicadores",   color: "bg-blue-600"  },
    { label: "Resumen",          path: "/resumen",       color: "bg-gray-700"  },
  ],
  gerencia: [
    { label: "Pendientes",       path: "/historial?bandeja=1", color: "bg-amber-600" },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-[#004990]" },
    { label: "Indicadores",      path: "/indicadores",   color: "bg-blue-600"  },
  ],
  finanzas: [
    { label: "Registrar Pago",   path: "/pago",          color: "bg-green-600" },
    { label: "Historial Pagos",  path: "/pagos",         color: "bg-[#004990]" },
    { label: "Flujos Financ.",   path: "/flujos-financieros", color: "bg-blue-600" },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-gray-600"  },
  ],
  "gerencia finanzas": [
    { label: "Historial Pagos",  path: "/pagos",         color: "bg-[#004990]" },
    { label: "Dashboard",        path: "/dashboard",     color: "bg-blue-600"  },
    { label: "Flujos Financ.",   path: "/flujos-financieros", color: "bg-green-600" },
    { label: "Indicadores",      path: "/indicadores",   color: "bg-gray-600"  },
  ],
  administracion: [
    { label: "Caja Chica",       path: "/caja",          color: "bg-green-600" },
    { label: "Historial OCs",    path: "/historial",     color: "bg-[#004990]" },
    { label: "Flujos Financ.",   path: "/flujos-financieros", color: "bg-blue-600" },
  ],
  legal: [
    { label: "Historial OCs",    path: "/historial",     color: "bg-[#004990]" },
    { label: "Exportaciones",    path: "/exportaciones", color: "bg-green-600" },
  ],
  soporte: [
    { label: "Tickets",          path: "/adminsoporte",  color: "bg-[#004990]" },
    { label: "Logs",             path: "/logs",          color: "bg-red-600"   },
    { label: "Historial OCs",    path: "/historial",     color: "bg-gray-600"  },
  ],
};

// Roles que pueden aprobar solicitudes de edición
const ROLES_APROBADORES_SOL = ["operaciones", "gerencia", "gerencia operaciones", "gerencia general", "admin"];

// ── Colores para estados ─────────────────────────────────────
const BADGE = {
  "Pendiente de Operaciones":          "bg-amber-100 text-amber-800",
  "Pendiente de Gerencia Operaciones": "bg-orange-100 text-orange-800",
  "Pendiente de Gerencia General":     "bg-red-100 text-red-700",
  "Aprobada": "bg-green-100 text-green-800",
  "Rechazada": "bg-red-100 text-red-700",
  "Pagado":   "bg-blue-100 text-blue-800",
};
const badgeClass = (estado) => BADGE[estado] || "bg-gray-100 text-gray-600";

// ──────────────────────────────────────────────────────────────
const Home = () => {
  const navigate              = useNavigate();
  const { usuario }           = useUsuario();
  const { pendientes = [] }   = usePendientes();

  const [recentOCs, setRecentOCs]                 = useState([]);
  const [kpis, setKpis]                           = useState({ aprobadas: 0, rechazadas: 0, montoSoles: 0, montoDolares: 0 });
  const [cargando, setCargando]                   = useState(true);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]); // para operaciones
  const [solicitudesAprobadas, setSolicitudesAprobadas]   = useState([]); // para comprador

  const rol = (usuario?.rol || "").toLowerCase();

  useEffect(() => {
    (async () => {
      try {
        // Recientes para la tabla (últimas 5)
        const recientes = await obtenerOCs(30).catch(() => []);
        setRecentOCs((recientes || []).slice(0, 5));

        // KPIs: usar TODAS las OCs para no perder aprobadas con número bajo
        const todas = await obtenerTodasOC().catch(() => []);

        const hoy  = new Date();
        const mes  = hoy.getMonth();
        const anio = hoy.getFullYear();

        const delMes = (todas || []).filter((oc) => {
          let f = null;
          if (oc.fechaEmision) {
            const parts = String(oc.fechaEmision).split("-");
            if (parts.length === 3) {
              f = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            }
          }
          if (!f && oc.creadaEn?.seconds) {
            f = new Date(oc.creadaEn.seconds * 1000);
          }
          if (!f) return false;
          return f.getMonth() === mes && f.getFullYear() === anio;
        });

        const aprobadas = delMes.filter((o) => o.estado === "Aprobada");
        setKpis({
          aprobadas:    aprobadas.length,
          rechazadas:   delMes.filter((o) => o.estado === "Rechazada").length,
          montoSoles:   aprobadas
            .filter((o) => o.monedaSeleccionada !== "Dólares")
            .reduce((s, o) => s + (Number(o.resumen?.total) || 0), 0),
          montoDolares: aprobadas
            .filter((o) => o.monedaSeleccionada === "Dólares")
            .reduce((s, o) => s + (Number(o.resumen?.total) || 0), 0),
        });

        // Solicitudes de edición: según rol
        if (ROLES_APROBADORES_SOL.includes(rol)) {
          const pendientes = await listarSolicitudesPendientesGlobal().catch(() => []);
          setSolicitudesPendientes(pendientes);
        }
        if (rol === "comprador" && usuario?.email) {
          const todas = await listarSolicitudesPorEmail(usuario.email).catch(() => []);
          setSolicitudesAprobadas(todas.filter((s) => s.estado === "aprobada"));
        }
      } catch (e) {
        console.error("[Home] Error cargando datos:", e);
      } finally {
        setCargando(false);
      }
    })();
  }, [rol, usuario?.email]);

  const accesos = ACCESOS_POR_ROL[rol] || ACCESOS_POR_ROL["comprador"];
  const nombreMes = new Date().toLocaleString("es-PE", { month: "long" });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-[#004990]">
          Bienvenido, {usuario?.nombre || usuario?.email?.split("@")[0]}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Rol: <span className="font-medium capitalize">{usuario?.rol}</span>
          {" · "}
          {new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-amber-700">{pendientes.length}</p>
          <p className="text-xs text-amber-600 mt-1">Pendientes de aprobación</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-700">{kpis.aprobadas}</p>
          <p className="text-xs text-green-600 mt-1">Aprobadas este mes</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-red-700">{kpis.rechazadas}</p>
          <p className="text-xs text-red-600 mt-1">Rechazadas este mes</p>
        </div>
        {/* KPI monto: S/ y USD separados */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          {kpis.montoSoles > 0 || kpis.montoDolares === 0 ? (
            <p className="text-xl font-bold text-blue-700 leading-tight">
              S/ {kpis.montoSoles.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
            </p>
          ) : null}
          {kpis.montoDolares > 0 ? (
            <p className="text-xl font-bold text-blue-700 leading-tight">
              $ {kpis.montoDolares.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
            </p>
          ) : null}
          <p className="text-xs text-blue-600 mt-1">Monto aprobado ({nombreMes})</p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {accesos.map(({ label, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`${color} text-white rounded-lg px-4 py-3 text-sm font-semibold text-left hover:opacity-90 transition-opacity shadow-sm`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Solicitudes de edición aprobadas → comprador puede editar */}
      {solicitudesAprobadas.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wide">
              Edición habilitada — puedes modificar tus OCs ({solicitudesAprobadas.length})
            </h2>
          </div>
          <div className="space-y-2">
            {solicitudesAprobadas.map((sol) => (
              <div
                key={sol.id}
                className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-semibold text-sm text-indigo-800">
                    {sol.numeroOC || sol.ocId}
                  </span>
                  <span className="text-gray-500 text-sm ml-2 truncate max-w-xs hidden sm:inline">
                    {sol.motivo}
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/editar?id=${sol.ocId}`)}
                  className="bg-indigo-600 text-white text-xs px-3 py-1 rounded hover:bg-indigo-700 flex-shrink-0"
                >
                  Editar OC
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solicitudes de edición pendientes → operaciones/gerencia las aprueba */}
      {solicitudesPendientes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-orange-600 uppercase tracking-wide">
              Solicitudes de edición pendientes ({solicitudesPendientes.length})
            </h2>
            <button
              onClick={() => navigate("/historial")}
              className="text-xs text-orange-700 underline"
            >
              Ver en historial
            </button>
          </div>
          <div className="space-y-2">
            {solicitudesPendientes.slice(0, 5).map((sol) => (
              <div
                key={sol.id}
                className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <span className="font-mono font-semibold text-sm text-orange-800">
                    {sol.numeroOC || sol.ocId}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    por {sol.creadoPorNombre || sol.creadoPorEmail}
                  </span>
                  {sol.motivo && (
                    <p className="text-xs text-gray-600 mt-0.5 truncate">{sol.motivo}</p>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/ver?id=${sol.ocId}`)}
                  className="bg-orange-600 text-white text-xs px-3 py-1 rounded hover:bg-orange-700 flex-shrink-0 ml-2"
                >
                  Revisar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimas OCs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Últimas órdenes
          </h2>
          <button
            onClick={() => navigate("/historial")}
            className="text-xs text-[#004990] underline"
          >
            Ver todas
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-x-auto">
          {cargando ? (
            <div className="p-6"><div className="animate-pulse space-y-2">{[1,2,3].map(i=><div key={i} className="h-8 bg-gray-100 rounded"/>)}</div></div>
          ) : recentOCs.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">No hay órdenes registradas aún.</p>
          ) : (
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2 text-left">N° OC</th>
                  <th className="px-4 py-2 text-left">Proveedor</th>
                  <th className="px-4 py-2 text-left hidden md:table-cell">Fecha</th>
                  <th className="px-4 py-2 text-right hidden md:table-cell">Total</th>
                  <th className="px-4 py-2 text-left">Estado</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentOCs.map((oc) => (
                  <tr key={oc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono font-semibold text-xs">
                      {oc.numeroOC || oc.numero}
                    </td>
                    <td className="px-4 py-2 truncate max-w-[160px]">
                      {oc.proveedor?.razonSocial || "—"}
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell text-gray-500">
                      {oc.fechaEmision || "—"}
                    </td>
                    <td className="px-4 py-2 hidden md:table-cell text-right">
                      {oc.resumen?.total != null
                        ? `${oc.monedaSeleccionada === "Dólares" ? "$ " : "S/ "}${Number(oc.resumen.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass(oc.estado)}`}>
                        {oc.estado || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => navigate(`/ver?id=${oc.id}`)}
                        className="text-xs text-[#004990] underline"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pendientes de acción */}
      {pendientes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-600 uppercase tracking-wide">
              Pendientes de tu aprobación ({pendientes.length})
            </h2>
            <button
              onClick={() => navigate("/historial?bandeja=1")}
              className="text-xs text-amber-700 underline"
            >
              Ver bandeja
            </button>
          </div>
          <div className="space-y-2">
            {pendientes.slice(0, 4).map((oc) => (
              <div
                key={oc.id}
                className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between"
              >
                <div>
                  <span className="font-mono font-semibold text-sm">
                    {oc.numeroOC || oc.numero}
                  </span>
                  <span className="text-gray-500 text-sm ml-2">
                    {oc.proveedor?.razonSocial || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {oc.resumen?.total != null && (
                    <span className="text-sm font-semibold">
                      {oc.monedaSeleccionada === "Dólares" ? "$ " : "S/ "}
                      {Number(oc.resumen.total).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/firmar?id=${oc.id}`)}
                    className="bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700"
                  >
                    Firmar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Soporte */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-800 flex items-center justify-between">
        <span>¿Necesitas ayuda? Contacta al equipo de soporte.</span>
        <button
          onClick={() => navigate("/soporte")}
          className="ml-4 bg-yellow-500 text-white px-3 py-1 rounded text-xs hover:bg-yellow-600"
        >
          Abrir ticket
        </button>
      </div>
    </div>
  );
};

export default Home;
