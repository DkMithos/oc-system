// ✅ src/components/nav/HistorialNavItem.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { usePendientes } from "../../context/PendientesContext";
import { useUsuario } from "../../context/UsuarioContext";
import { isGerenciaRole } from "../../utils/aprobaciones";

const HistorialNavItem = ({ collapsed = false }) => {
  const { total } = usePendientes();
  const { usuario } = useUsuario();
  const showBadge = !!usuario && isGerenciaRole(usuario.rol) && total > 0;

  return (
    <NavLink
      to="/historial"
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-100 transition ${
          isActive ? "bg-gray-100 text-[#004990]" : "text-gray-700"
        }`
      }
      title="Historial"
    >
      <div className="relative">
        <ClipboardList size={20} />
        {showBadge && (
          <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1.5 text-[10px] leading-[18px] text-white bg-red-600 rounded-full text-center">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </div>
      {!collapsed && <span>Historial</span>}
    </NavLink>
  );
};

export default HistorialNavItem;
