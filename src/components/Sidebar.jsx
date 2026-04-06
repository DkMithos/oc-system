// src/components/Sidebar.jsx — Enterprise ERP Sidebar
import { NavLink } from "react-router-dom";
import { useState } from "react";
import {
  Home, ClipboardList, ShoppingCart, FileText, Users, Package,
  DollarSign, BarChart2, CreditCard, ArrowDownCircle, TrendingUp,
  PieChart, Download, Activity, LifeBuoy, MessageSquare, PenTool,
  Settings, FolderOpen, BookOpen, ChevronDown, LogOut, X
} from "lucide-react";
import { puedeAcceder } from "../utils/permisosPorRol";
import { useUsuario } from "../context/UsuarioContext";
import logo from "../assets/logo-navbar.png";

const MENU = [
  {
    id: "compras",
    label: "Compras",
    icon: ShoppingCart,
    items: [
      { ruta: "/",              texto: "Inicio",           icon: Home },
      { ruta: "/historial",     texto: "Historial OC",     icon: ClipboardList },
      { ruta: "/crear",         texto: "Nueva Orden",      icon: FileText },
      { ruta: "/cotizaciones",  texto: "Cotizaciones",     icon: Package },
      { ruta: "/proveedores",   texto: "Proveedores",      icon: Users },
      { ruta: "/requerimientos",texto: "Requerimientos",   icon: ClipboardList },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    icon: DollarSign,
    items: [
      { ruta: "/caja",              texto: "Caja Chica",       icon: CreditCard },
      { ruta: "/dashboard",         texto: "Dashboard",         icon: BarChart2 },
      { ruta: "/pagos",             texto: "Historial de Pagos",icon: CreditCard },
      { ruta: "/pago",              texto: "Registrar Pago",    icon: ArrowDownCircle },
      { ruta: "/flujos-financieros",texto: "Flujos Financieros",icon: TrendingUp },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    icon: PieChart,
    items: [
      { ruta: "/indicadores",    texto: "Indicadores",          icon: Activity },
      { ruta: "/resumen",        texto: "Resumen General",      icon: BarChart2 },
      { ruta: "/reportes",       texto: "Reportería",           icon: FileText },
      { ruta: "/exportaciones",  texto: "Centro de Exportaciones", icon: Download },
    ],
  },
  {
    id: "soporte",
    label: "Soporte",
    icon: LifeBuoy,
    items: [
      { ruta: "/soporte",     texto: "Tickets",       icon: MessageSquare },
      { ruta: "/adminsoporte",texto: "Admin Tickets", icon: Settings },
      { ruta: "/mi-firma",    texto: "Mi Firma",      icon: PenTool },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Settings,
    items: [
      { ruta: "/admin",          texto: "Panel Admin",     icon: Settings },
      { ruta: "/cargar-maestros",texto: "Cargar Maestros", icon: FolderOpen },
      { ruta: "/logs",           texto: "Bitácora",        icon: BookOpen },
    ],
  },
];

const ROL_LABELS = {
  admin: "Administrador",
  soporte: "Soporte TI",
  comprador: "Compras",
  operaciones: "Operaciones",
  "gerencia operaciones": "Ger. Operaciones",
  "gerencia general": "Ger. General",
  "gerencia": "Gerencia",
  finanzas: "Finanzas",
  "gerencia finanzas": "Ger. Finanzas",
  administracion: "Administración",
  legal: "Legal",
};

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const rol   = String(usuario?.rol || "").toLowerCase();
  const email = usuario?.email || "";
  const nombre = usuario?.nombre || email.split("@")[0];

  const [grupoAbierto, setGrupoAbierto] = useState("compras");

  const toggle = (id) => setGrupoAbierto((prev) => prev === id ? "" : id);
  const onNav  = () => { if (isOpen) toggleSidebar?.(); };

  return (
    <>
      {/* Overlay móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      <aside className={`
        fixed top-0 left-0 h-screen z-40 flex flex-col
        w-64 bg-[#012b5a] text-white
        transform transition-transform duration-250
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        shadow-2xl
      `}>

        {/* ── Header ─────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Memphis" className="h-8 w-auto" />
            <div>
              <p className="text-sm font-bold leading-none tracking-tight">Memphis ERP</p>
              <p className="text-[10px] text-white/50 mt-0.5">Sistema de Gestión</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="lg:hidden text-white/60 hover:text-white p-1 rounded"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Perfil ─────────────────────────────── */}
        <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-blue-900 font-bold text-sm flex-shrink-0">
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate leading-none">{nombre}</p>
              <p className="text-[10px] text-white/50 truncate mt-0.5">{email}</p>
              <span className="inline-block mt-1 text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                {ROL_LABELS[rol] || rol}
              </span>
            </div>
          </div>
        </div>

        {/* ── Navegación ─────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {MENU.map((grupo) => {
            const abierto   = grupoAbierto === grupo.id;
            const GrupoIcon = grupo.icon;

            // Filtrar items accesibles
            const itemsVisibles = grupo.items.filter((it) => puedeAcceder(rol, it.ruta));
            if (!itemsVisibles.length) return null;

            return (
              <div key={grupo.id}>
                {/* Cabecera de grupo */}
                <button
                  onClick={() => toggle(grupo.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg
                             text-white/70 hover:text-white hover:bg-white/8
                             transition-colors duration-150 group"
                >
                  <span className="flex items-center gap-2.5">
                    <GrupoIcon size={15} className="flex-shrink-0 group-hover:text-amber-400 transition-colors" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{grupo.label}</span>
                  </span>
                  <ChevronDown
                    size={13}
                    className={`transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
                  />
                </button>

                {/* Items */}
                {abierto && (
                  <div className="mt-0.5 mb-1 ml-2 space-y-0.5 pl-3 border-l border-white/10">
                    {itemsVisibles.map((item) => {
                      const Icon = item.icon;
                      return (
                        <NavLink
                          key={item.ruta}
                          to={item.ruta}
                          onClick={onNav}
                          className={({ isActive }) =>
                            `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs
                             transition-all duration-150
                             ${isActive
                               ? "bg-amber-400 text-[#012b5a] font-semibold shadow-sm"
                               : "text-white/65 hover:text-white hover:bg-white/8"
                             }`
                          }
                        >
                          <Icon size={13} className="flex-shrink-0" />
                          {item.texto}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── Footer ─────────────────────────────── */}
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                       text-white/60 hover:text-white hover:bg-red-600/20
                       text-xs transition-colors duration-150"
          >
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
