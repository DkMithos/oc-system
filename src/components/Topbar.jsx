// ✅ src/components/Topbar.jsx
import { Menu, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-navbar.png";

import Notificaciones from "./Notificaciones";
import BandejaOCBadge from "./BandejaOCBadge";              // badge compacto (móvil)
import AprobacionesHeaderBadge from "./AprobacionesHeaderBadge"; // banner con contador (desktop)

import { useUsuario } from "../context/UsuarioContext";

const Topbar = ({ toggleSidebar }) => {
  const { usuario, cerrarSesion } = useUsuario();

  return (
    <header className="bg-blue-900 text-white shadow-md sticky top-0 z-40">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Izquierda: menú + logo */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSidebar}
            className="focus:outline-none"
            title="Abrir menú"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>

          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="Memphis Logo" className="h-10" />
            <h1 className="text-lg font-semibold">Sistema de Gestión Memphis</h1>
          </Link>
        </div>

        {/* Derecha: badges + notificaciones + usuario */}
        <div className="flex items-center gap-3">
          {/* Badge compacto (solo móvil) */}
          {usuario && (
            <div className="sm:hidden">
              <BandejaOCBadge size="sm" />
            </div>
          )}

          {/* Banner de pendientes (desktop y superiores) */}
          {usuario && (
            <div className="hidden sm:block">
              <AprobacionesHeaderBadge />
            </div>
          )}

          {/* Notificaciones (FCM) */}
          <Notificaciones />

          {/* Chip de usuario/rol (solo si hay sesión) */}
          {usuario && (
            <div className="hidden sm:flex items-center gap-2 bg-white/10 px-2 py-1 rounded">
              <span className="text-xs opacity-90">{usuario.email}</span>
              <span className="text-[10px] bg-amber-400 text-blue-900 px-2 py-0.5 rounded-full font-bold uppercase">
                {usuario.rol}
              </span>
            </div>
          )}

          {/* Botón salir */}
          {usuario && (
            <button
              onClick={cerrarSesion}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
              <span className="text-sm hidden sm:inline">Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Topbar;
