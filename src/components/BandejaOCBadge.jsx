import React from "react";
import { useNavigate } from "react-router-dom";
import { Inbox } from "lucide-react";
import { usePendientes } from "../context/PendientesContext";
import { useUsuario } from "../context/UsuarioContext";
import { isGerenciaRole } from "../utils/aprobaciones";

const sizeClasses = {
  sm: { icon: 16, pill: "px-2 py-1 text-xs", dot: "min-w-[16px] h-[16px] text-[10px]" },
  md: { icon: 18, pill: "px-3 py-1.5 text-sm", dot: "min-w-[18px] h-[18px] text-[10px]" },
  lg: { icon: 20, pill: "px-3.5 py-2 text-sm", dot: "min-w-[20px] h-[20px] text-[11px]" },
};

const BandejaOCBadge = ({ size = "md", targetQuery = "?pendientes=1", className = "" }) => {
  const navigate = useNavigate();
  const { usuario } = useUsuario();
  const { total, loading } = usePendientes();

  if (!usuario || !isGerenciaRole(usuario.rol)) return null;
  if (loading) return null;

  const s = sizeClasses[size] ?? sizeClasses.md;

  return (
    <button
      onClick={() => navigate({ pathname: "/historial", search: targetQuery })}
      title="Ver órdenes pendientes por aprobar/firmar"
      className={`inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 transition ${s.pill} ${className}`}
      style={{ lineHeight: 1 }}
    >
      <Inbox size={s.icon} />
      <span className="font-semibold">Bandeja</span>
      <span className={`inline-flex items-center justify-center rounded-full bg-amber-600 text-white ${s.dot} px-1.5 leading-none`}>
        {total > 99 ? "99+" : total}
      </span>
    </button>
  );
};

export default BandejaOCBadge;
