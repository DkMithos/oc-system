// =========================================
// Sidebar ERP MEMPHIS – Modernizado
// =========================================

import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import permisosPorRol, { puedeAcceder } from "../utils/permisosPorRol";
import { useUsuario } from "../context/UsuarioContext";
import logo from "../assets/logo-navbar.png";

// Grupos del menú tipo ERP
const grupos = [
  {
    id: "compras",
    label: "Compras",
    items: [
      { ruta: "/", texto: "Home" },
      { ruta: "/historial", texto: "Historial" },
      { ruta: "/crear", texto: "Generar Órdenes" },
      { ruta: "/cotizaciones", texto: "Cotizaciones" },
      { ruta: "/proveedores", texto: "Proveedores" },
      { ruta: "/requerimientos", texto: "Requerimientos" },
    ],
  },
  {
    id: "finanzas",
    label: "Finanzas",
    items: [
      { ruta: "/caja", texto: "Caja Chica" },
      { ruta: "/dashboard", texto: "Dashboard" },
      { ruta: "/pagos", texto: "Historial de Pagos" },
      { ruta: "/pago", texto: "Registrar Pago" },
      { ruta: "/flujos-financieros", texto: "Flujos Financieros" },
    ],
  },
  {
    id: "reportes",
    label: "Reportes",
    items: [
      { ruta: "/indicadores", texto: "Indicadores" },
      { ruta: "/resumen", texto: "Resumen General" },
      { ruta: "/reportes", texto: "Reportería" },
    ],
  },
  {
    id: "soporte",
    label: "Soporte",
    items: [
      { ruta: "/soporte", texto: "Tickets" },
      { ruta: "/adminsoporte", texto: "Admin de Tickets" },
      { ruta: "/mi-firma", texto: "Mi Firma" },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    items: [
      { ruta: "/admin", texto: "Panel Administrativo" },
      { ruta: "/cargar-maestros", texto: "Cargar Maestros" },
      { ruta: "/logs", texto: "Bitácora" },
    ],
  },
];

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [grupoAbierto, setGrupoAbierto] = useState("compras");

  useEffect(() => {
    if (usuario) {
      setUserRole(String(usuario.rol || "").toLowerCase());
      setUserEmail(usuario.email || "");
    }
  }, [usuario]);

  const puede = (ruta) => puedeAcceder(userRole, ruta);

  const onNav = () => {
    if (isOpen) toggleSidebar?.();
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 z-40 bg-[#012b5a] text-white transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-300 shadow-xl`}
    >
      {/* HEADER */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <img src={logo} alt="Memphis" className="h-9" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Memphis</h2>
          <p className="text-[11px] text-white/70">Sistema de Compras</p>
        </div>
      </div>

      {/* NAVEGACIÓN */}
      <nav className="overflow-y-auto h-[calc(100%-140px)] px-2 py-3 space-y-2">
        {grupos.map((grupo) => {
          const isOpenGroup = grupoAbierto === grupo.id;

          return (
            <div key={grupo.id} className="select-none">
              {/* TÍTULO DE GRUPO */}
              <button
                className="w-full flex items-center justify-between px-3 py-2 text-sm tracking-wide font-semibold text-white/90 hover:bg-white/10 rounded"
                onClick={() =>
                  setGrupoAbierto((prev) =>
                    prev === grupo.id ? "" : grupo.id
                  )
                }
              >
                {grupo.label}
                <span
                  className={`transform text-xs transition-transform ${
                    isOpenGroup ? "rotate-90" : ""
                  }`}
                >
                  ▶
                </span>
              </button>

              {/* ITEMS */}
              {isOpenGroup && (
                <div className="mt-1 space-y-1">
                  {grupo.items.map((item) =>
                    puede(item.ruta) ? (
                      <NavLink
                        key={item.ruta}
                        to={item.ruta}
                        onClick={onNav}
                        className={({ isActive }) =>
                          `block pl-8 pr-3 py-1.5 rounded text-sm transition-all ${
                            isActive
                              ? "bg-yellow-300 text-[#012b5a] font-semibold shadow-inner"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`
                        }
                      >
                        {item.texto}
                      </NavLink>
                    ) : null
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="px-5 py-4 border-t border-white/10 text-sm">
        <p className="text-white/80 truncate">{userEmail}</p>
        <p className="text-xs text-white/50 mb-2">{userRole}</p>
        <button
          onClick={cerrarSesion}
          className="text-white text-xs underline hover:text-yellow-300"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
