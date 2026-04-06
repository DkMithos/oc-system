// src/components/Topbar.jsx — Enterprise ERP Topbar
import { Menu, Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
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

/** Breadcrumb mapping para rutas conocidas */
const BREADCRUMB_MAP = {
  "/":                  ["Compras", "Inicio"],
  "/historial":         ["Compras", "Historial OC"],
  "/crear":             ["Compras", "Nueva Orden"],
  "/cotizaciones":      ["Compras", "Cotizaciones"],
  "/proveedores":       ["Compras", "Proveedores"],
  "/requerimientos":    ["Compras", "Requerimientos"],
  "/caja":              ["Finanzas", "Caja Chica"],
  "/dashboard":         ["Finanzas", "Dashboard"],
  "/pagos":             ["Finanzas", "Historial de Pagos"],
  "/pago":              ["Finanzas", "Registrar Pago"],
  "/flujos-financieros":["Finanzas", "Flujos Financieros"],
  "/indicadores":       ["Reportes", "Indicadores"],
  "/resumen":           ["Reportes", "Resumen General"],
  "/reportes":          ["Reportes", "Reportería"],
  "/exportaciones":     ["Reportes", "Centro de Exportaciones"],
  "/soporte":           ["Soporte", "Tickets"],
  "/adminsoporte":      ["Soporte", "Admin Tickets"],
  "/mi-firma":          ["Soporte", "Mi Firma"],
  "/admin":             ["Sistema", "Panel Admin"],
  "/cargar-maestros":   ["Sistema", "Cargar Maestros"],
  "/logs":              ["Sistema", "Bitácora"],
};

const Topbar = ({ toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const rol    = String(usuario?.rol || "").toLowerCase();
  const email  = usuario?.email || "";
  const nombre = usuario?.nombre || email.split("@")[0];
  const rolLabel = ROL_LABELS[rol] || rol;

  const crumbs = BREADCRUMB_MAP[location.pathname] || ["Sistema", location.pathname.replace("/", "") || "Inicio"];

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
    <header className="bg-[#012b5a] text-white sticky top-0 z-30 border-b border-white/10">
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

          {/* Separador */}
          <div className="hidden md:block w-px h-6 bg-white/20 flex-shrink-0" />

          {/* Breadcrumb */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-white/50 truncate">{crumbs[0]}</span>
            <span className="text-white/30">/</span>
            <span className="text-white font-medium truncate">{crumbs[1]}</span>
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
                <div className="w-7 h-7 rounded-full bg-amber-400 flex items-center justify-center
                                text-[#012b5a] font-bold text-xs flex-shrink-0">
                  {nombre.charAt(0).toUpperCase()}
                </div>
                {/* Info (desktop) */}
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold leading-none truncate max-w-[120px]">{nombre}</p>
                  <p className="text-[10px] text-white/50 leading-none mt-0.5">{rolLabel}</p>
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
                    <span className="inline-block mt-1.5 text-[10px] bg-blue-900/10 text-blue-900
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
                                 hover:bg-gray-50 transition-colors"
                    >
                      <User size={14} className="text-gray-400" />
                      Mi Firma
                    </Link>
                    {rol === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700
                                   hover:bg-gray-50 transition-colors"
                      >
                        <Settings size={14} className="text-gray-400" />
                        Panel Admin
                      </Link>
                    )}
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 py-1">
                    <button
                      onClick={() => { setDropdownOpen(false); cerrarSesion(); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600
                                 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={14} />
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
