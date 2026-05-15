// src/components/Topbar.jsx — Enterprise ERP Topbar (responsive)
import { Menu, ChevronDown, LogOut, User, Settings, Home } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import logo from "../assets/logo-navbar.png";

import Notificaciones from "./Notificaciones";
import AprobacionesHeaderBadge from "./AprobacionesHeaderBadge";

import { useUsuario } from "../context/UsuarioContext";

const ROL_LABELS = {
  admin: "Administrador",
  soporte: "Soporte TI",
  comprador: "Compras",
  operaciones: "Operaciones",
  "gerencia operaciones": "Ger. Operaciones",
  "gerencia general": "Ger. General",
  gerencia: "Gerencia",
  finanzas: "Finanzas",
  "gerencia finanzas": "Ger. Finanzas",
  administracion: "Administración",
  legal: "Legal",
};

/**
 * Cada entrada define:
 *  - modulo: texto del primer segmento
 *  - label: texto del segundo segmento
 *  - moduloLink: ruta al hacer clic en el módulo (opcional)
 *  - parentLink: ruta al hacer clic en el label (si hay un tercer segmento)
 *  - match: regex para rutas dinámicas (opcional)
 *  - getId: función para extraer el ID del pathname (opcional)
 */
const RUTAS = [
  { path: "/",                   modulo: "Inicio",   moduloLink: null,         label: "Inicio" },
  { path: "/historial",          modulo: "Compras",  moduloLink: "/historial", label: "Historial OC" },
  { path: "/crear",              modulo: "Compras",  moduloLink: "/historial", label: "Nueva Orden" },
  { path: "/cotizaciones",       modulo: "Compras",  moduloLink: "/historial", label: "Cotizaciones" },
  { path: "/proveedores",        modulo: "Compras",  moduloLink: "/historial", label: "Proveedores" },
  { path: "/requerimientos",     modulo: "Compras",  moduloLink: "/historial", label: "Requerimientos" },
  { path: "/inventario",         modulo: "Compras",  moduloLink: "/historial", label: "Inventario" },
  { path: "/recepcion",          modulo: "Compras",  moduloLink: "/historial", label: "Recepción de Bienes" },
  { path: "/solicitudes-edicion",modulo: "Compras",  moduloLink: "/historial", label: "Solicitudes de Edición" },
  { path: "/caja",               modulo: "Finanzas", moduloLink: "/dashboard", label: "Caja Chica" },
  { path: "/dashboard",          modulo: "Finanzas", moduloLink: "/dashboard", label: "Dashboard" },
  { path: "/pagos",              modulo: "Finanzas", moduloLink: "/dashboard", label: "Historial de Pagos" },
  { path: "/pago",               modulo: "Finanzas", moduloLink: "/dashboard", label: "Registrar Pago" },
  { path: "/pagos-cc",           modulo: "Finanzas", moduloLink: "/dashboard", label: "Pagos por Centro de Costo" },
  { path: "/flujos-financieros", modulo: "Finanzas", moduloLink: "/dashboard", label: "Flujos Financieros" },
  { path: "/dashboard-gerencial",modulo: "Finanzas", moduloLink: "/dashboard", label: "Dashboard Gerencial" },
  { path: "/presupuesto-vs-ejecutado", modulo: "Finanzas", moduloLink: "/dashboard", label: "Presupuesto vs Ejecutado" },
  { path: "/mesa-pagos",         modulo: "Finanzas", moduloLink: "/dashboard", label: "Mesa de Pagos" },
  { path: "/compromisos",        modulo: "Finanzas", moduloLink: "/dashboard", label: "Compromisos Activos" },
  { path: "/instrumentos-financieros", modulo: "Finanzas", moduloLink: "/dashboard", label: "Instrumentos (CIPRL)" },
  { path: "/planificacion",      modulo: "Finanzas", moduloLink: "/dashboard", label: "Planificación de Pagos" },
  { path: "/importar-flujos",    modulo: "Finanzas", moduloLink: "/dashboard", label: "Importar Flujos" },
  { path: "/reportes",           modulo: "Reportes", moduloLink: "/reportes",  label: "Reportería" },
  { path: "/exportaciones",      modulo: "Reportes", moduloLink: "/reportes",  label: "Centro de Exportaciones" },
  { path: "/soporte",            modulo: "Soporte",  moduloLink: "/soporte",   label: "Tickets" },
  { path: "/adminsoporte",       modulo: "Soporte",  moduloLink: "/soporte",   label: "Admin Tickets" },
  { path: "/mi-firma",           modulo: "Soporte",  moduloLink: "/soporte",   label: "Mi Firma" },
  { path: "/admin",              modulo: "Sistema",  moduloLink: "/admin",     label: "Panel Admin" },
  { path: "/cargar-maestros",    modulo: "Sistema",  moduloLink: "/admin",     label: "Cargar Maestros" },
  { path: "/logs",               modulo: "Sistema",  moduloLink: "/admin",     label: "Bitácora" },
  // Rutas dinámicas
  { match: /^\/oc\/(.+)$/,       modulo: "Compras",  moduloLink: "/historial", label: "Ver OC",      getId: (m) => m[1] },
  { match: /^\/editar\/(.+)$/,   modulo: "Compras",  moduloLink: "/historial", label: "Editar OC",   getId: (m) => m[1] },
  { match: /^\/firmar\/(.+)$/,   modulo: "Compras",  moduloLink: "/historial", label: "Firmar OC",   getId: (m) => m[1] },
  { match: /^\/pago\/(.+)$/,     modulo: "Finanzas", moduloLink: "/pagos",     label: "Registrar Pago", getId: (m) => m[1] },
];

/** Construye los segmentos del breadcrumb según el pathname */
const buildCrumbs = (pathname) => {
  // Buscar primero coincidencia exacta
  const exacta = RUTAS.find((r) => r.path === pathname);
  if (exacta) {
    return [
      { label: exacta.modulo, link: exacta.moduloLink },
      { label: exacta.label,  link: null },
    ];
  }
  // Buscar coincidencia por regex (rutas dinámicas)
  for (const ruta of RUTAS) {
    if (!ruta.match) continue;
    const m = pathname.match(ruta.match);
    if (m) {
      const id = ruta.getId ? ruta.getId(m) : null;
      return [
        { label: ruta.modulo, link: ruta.moduloLink },
        { label: ruta.label,  link: ruta.moduloLink },
        { label: id,          link: null },
      ];
    }
  }
  // Fallback
  return [{ label: pathname.replace("/", "") || "Inicio", link: null }];
};

const Topbar = ({ toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const isHome = location.pathname === "/";
  const dropdownRef = useRef(null);

  const rol    = String(usuario?.rol || "").toLowerCase();
  const email  = usuario?.email || "";
  const nombre = usuario?.nombre || email.split("@")[0];
  const rolLabel = ROL_LABELS[rol] || rol;

  const crumbs = buildCrumbs(location.pathname);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="bg-[#000000] text-white sticky top-0 z-30 border-b border-white/10">
      <div className="flex items-center justify-between h-14 px-4 gap-4">

        {/* ── Izquierda ─────────────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Hamburger */}
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>

          {/* Logo (solo desktop) */}
          <Link to="/" className="hidden md:flex items-center gap-2 flex-shrink-0">
            <img src={logo} alt="Memphis" className="h-7 w-auto" />
          </Link>

          {/* Botón Home — visible en cualquier página menos el Home */}
          {!isHome && (
            <Link
              to="/"
              className="hidden md:flex p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
              aria-label="Ir al inicio"
              title="Ir al inicio"
            >
              <Home size={16} />
            </Link>
          )}

          {/* Separador */}
          <div className="hidden md:block w-px h-6 bg-white/20 flex-shrink-0" />

          {/* Breadcrumb navegable */}
          <nav className="hidden sm:flex items-center gap-1 text-xs min-w-0">
            {crumbs.map((crumb, i) => {
              const esUltimo = i === crumbs.length - 1;
              return (
                <span key={i} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <span className="text-white/30 flex-shrink-0">/</span>}
                  {crumb.link && !esUltimo ? (
                    <Link
                      to={crumb.link}
                      className="text-white/60 hover:text-white hover:underline truncate transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={`truncate ${esUltimo ? "text-white font-medium" : "text-white/60"}`}>
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        </div>

        {/* ── Derecha ───────────────────────────────── */}
        <div className="flex items-center gap-2 flex-shrink-0">

          {/* Pendientes de aprobación (desktop) */}
          {usuario && (
            <div className="hidden lg:block">
              <AprobacionesHeaderBadge />
            </div>
          )}

          {/* Notificaciones */}
          <Notificaciones />

          {/* Divider */}
          {usuario && <div className="w-px h-6 bg-white/20" />}

          {/* User dropdown */}
          {usuario && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1.5 rounded-lg
                           hover:bg-white/10 transition-colors"
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full bg-[#f0c000] flex items-center justify-center
                                text-black font-bold text-xs flex-shrink-0">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                {/* Info (desktop) */}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold leading-none truncate max-w-[120px]">{nombre}</p>
                  <p className="text-[11px] text-white/50 leading-none mt-0.5">{rolLabel}</p>
                </div>
                <ChevronDown
                  size={13}
                  className={`hidden sm:block transition-transform duration-150 text-white/50
                              ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Dropdown menu */}
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl
                                border border-gray-100 py-1 z-50">
                  {/* User info header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-900 truncate">{nombre}</p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{email}</p>
                    <span className="inline-block mt-1.5 text-[11px] bg-blue-900/10 text-black
                                     border border-blue-900/20 px-2 py-0.5 rounded-full
                                     uppercase tracking-wider font-semibold">
                      {rolLabel}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="py-1">
                    <Link
                      to="/mi-firma"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700
                                 hover:bg-black hover:text-white transition-colors group"
                    >
                      <User size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                      Mi Firma
                    </Link>
                    {rol === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700
                                   hover:bg-black hover:text-white transition-colors group"
                      >
                        <Settings size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                        Panel Admin
                      </Link>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={() => { setDropdownOpen(false); cerrarSesion(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600
                                 hover:bg-red-600 hover:text-white transition-colors group"
                    >
                      <LogOut size={14} className="group-hover:text-white transition-colors" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
