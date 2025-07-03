// src/layout/Layout.jsx
import { Outlet, useNavigate, NavLink } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useEffect, useState } from "react";
import logo from "../assets/logo-navbar.png";
import Footer from "../components/Footer";

const Layout = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setUserRole(storedRole.toLowerCase());
  }, []);

  const handleLogout = () => {
    signOut(auth).then(() => {
      localStorage.clear();
      navigate("/");
      window.location.reload();
    });
  };

  const linkBase =
    "block px-4 py-2 rounded transition-colors duration-200 font-medium";
  const activeStyle = "bg-yellow-300 text-blue-900";
  const inactiveStyle = "text-white hover:bg-yellow-200 hover:text-blue-900";

  return (
    <div className="flex flex-col h-screen">
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="w-64 bg-blue-900 text-white p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-8">
              <img src={logo} alt="Memphis Logo" className="h-10" />
              <h2 className="text-xl font-bold">Gestión de OC</h2>
            </div>

            <nav className="space-y-1">
              {/* Opciones para FINANZAS */}
              {userRole === "finanzas" && (
                <>
                  <NavLink
                    to="/pagos"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Historial de Pagos
                  </NavLink>
                  <NavLink
                    to="/pago"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Registrar Pago
                  </NavLink>
                </>
              )}

              {/* Opciones para otros roles */}
              {["comprador", "admin", "operaciones", "gerencia"].includes(userRole) && (
                <>
                  <NavLink
                    to="/"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Historial
                  </NavLink>
                </>
              )}

              {(userRole === "comprador" || userRole === "admin") && (
                <>
                  <NavLink
                    to="/crear"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Crear OC
                  </NavLink>
                  <NavLink
                    to="/cotizaciones"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Cotizaciones
                  </NavLink>
                  <NavLink
                    to="/proveedores"
                    className={({ isActive }) =>
                      `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                    }
                  >
                    Proveedores
                  </NavLink>
                </>
              )}

              {userRole === "admin" && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                  }
                >
                  Panel Admin
                </NavLink>
              )}

              {["comprador", "admin", "gerencia", "operaciones"].includes(userRole) && (
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `${linkBase} ${isActive ? activeStyle : inactiveStyle}`
                  }
                >
                  📊 Dashboard
                </NavLink>
              )}
            </nav>
          </div>

          {/* Footer sidebar */}
          <div className="text-sm">
            <p className="mb-2 text-gray-300">
              {localStorage.getItem("userEmail")} ({userRole})
            </p>
            <button
              onClick={handleLogout}
              className="text-sm text-white underline hover:text-yellow-300 transition-all"
            >
              🚪 Cerrar sesión
            </button>
          </div>
        </aside>

        {/* Contenido */}
        <main className="flex-1 p-6 bg-gray-50 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Layout;
