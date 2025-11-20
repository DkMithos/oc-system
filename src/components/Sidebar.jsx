// ✅ src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import logo from "../assets/logo-navbar.png";
import permisosPorRol, { puedeAcceder } from "../utils/permisosPorRol";
import { useUsuario } from "../context/UsuarioContext";

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();
  const [userRole, setUserRole] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // Sincroniza con el context siempre
  useEffect(() => {
    if (usuario) {
      setUserRole(String(usuario.rol || "").toLowerCase());
      setUserEmail(usuario.email || "");
    } else {
      setUserRole("");
      setUserEmail("");
    }
  }, [usuario]);

  const puede = (ruta) => puedeAcceder(userRole, ruta);

  const linkBase =
    "block px-4 py-2 rounded transition-colors duration-200 font-medium";
  const activeStyle = "bg-yellow-300 text-blue-900";
  const inactiveStyle = "text-white hover:bg-yellow-200 hover:text-blue-900";

  // Cerrar sidebar al navegar (mejor UX en móvil)
  const onNav = () => {
    if (isOpen) toggleSidebar?.();
  };

  return (
    <aside
      className={`fixed top-0 left-0 h-full w-64 z-40 bg-blue-900 text-white transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } transition-transform duration-300`}
      aria-label="Sidebar de navegación"
    >
      <div className="p-4 flex flex-col justify-between h-full">
        <div>
          {/* Logo y título */}
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Memphis Logo" className="h-10" />
            <h2 className="text-xl font-bold">Compras</h2>
          </div>

          {/* Navegación dinámica por permisos */}
          <nav className="space-y-1">
            {puede("/") && (
              <NavLink
                to="/"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Home
              </NavLink>
            )}

            {puede("/historial") && (
              <NavLink
                to="/historial"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Historial
              </NavLink>
            )}

            {puede("/crear") && (
              <NavLink
                to="/crear"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Generar Órdenes
              </NavLink>
            )}

            {puede("/cotizaciones") && (
              <NavLink
                to="/cotizaciones"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Cotizaciones
              </NavLink>
            )}

            {puede("/proveedores") && (
              <NavLink
                to="/proveedores"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Proveedores
              </NavLink>
            )}

            {puede("/requerimientos") && (
              <NavLink
                to="/requerimientos"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Requerimientos
              </NavLink>
            )}

            {puede("/caja") && (
              <NavLink
                to="/caja"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Caja Chica
              </NavLink>
            )}

            {puede("/dashboard") && (
              <NavLink
                to="/dashboard"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Dashboard
              </NavLink>
            )}

            {puede("/pagos") && (
              <NavLink
                to="/pagos"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Historial de Pagos
              </NavLink>
            )}

            {puede("/pago") && (
              <NavLink
                to="/pago"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Registrar Pago
              </NavLink>
            )}
            {puede("/flujos-financieros") && (
              <NavLink
                to="/flujos-financieros"
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Flujos financieros
              </NavLink>
            )}

            {puede("/admin") && (
              <NavLink
                to="/admin"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Panel Administrativo
              </NavLink>
            )}

            {puede("/cargar-maestros") && (
              <NavLink
                to="/cargar-maestros"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Cargar Maestros
              </NavLink>
            )}

            {puede("/logs") && (
              <NavLink
                to="/logs"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Bitácora
              </NavLink>
            )}

            {puede("/indicadores") && (
              <NavLink
                to="/indicadores"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Indicadores
              </NavLink>
            )}

            {puede("/resumen") && (
              <NavLink
                to="/resumen"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Resumen General
              </NavLink>
            )}

            {puede("/soporte") && (
              <NavLink
                to="/soporte"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Soporte
              </NavLink>
            )}

            {puede("/adminsoporte") && (
              <NavLink
                to="/adminsoporte"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Admin de Tickets
              </NavLink>
            )}

            {/* NUEVO: Módulo "Mi Firma" (registrar/actualizar firma) */}
            {puede("/mi-firma") && (
              <NavLink
                to="/mi-firma"
                onClick={onNav}
                className={({ isActive }) =>
                  `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                }
              >
                Mi Firma
              </NavLink>
            )}
          </nav>
        </div>

        {/* Footer del sidebar */}
        <div className="text-sm mt-4">
          <p className="mb-2 text-gray-300 truncate">
            {userEmail || "—"} {userRole ? `(${userRole})` : ""}
          </p>
          <button
            onClick={cerrarSesion}
            className="text-white underline hover:text-yellow-300 transition-all"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
