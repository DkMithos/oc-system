// ✅ src/components/AprobacionesHeaderBadge.jsx
import React from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePendientes } from "../context/PendientesContext";
import { useUsuario } from "../context/UsuarioContext";
import { isBandejaRole } from "../utils/aprobaciones";

const AprobacionesHeaderBadge = () => {
  const { total, loading } = usePendientes();
  const { usuario } = useUsuario();
  const navigate = useNavigate();

  if (!usuario || !isBandejaRole(usuario.rol)) return null;

  const count = loading ? "…" : total;

  return (
    <button
      onClick={() => navigate("/historial?pendientes=1")}
      title="Ver pendientes de aprobación"
      className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 border border-amber-200 hover:bg-amber-200 transition"
      style={{ lineHeight: 1 }}
    >
      <AlertCircle size={16} />
      <span className="font-semibold">Pendientes</span>
      <span className="inline-flex items-center justify-center min-w-[24px] h-[24px] rounded-full bg-amber-500 text-white text-xs px-1.5">
        {count}
      </span>
    </button>
  );
};

export default AprobacionesHeaderBadge;
