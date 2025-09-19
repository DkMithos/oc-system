// ✅ src/components/AprobacionesHeaderBadge.jsx
import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useUsuario } from "../context/UsuarioContext";
import { ocPendingForRole, isGerenciaRole } from "../utils/aprobaciones";

const AprobacionesHeaderBadge = () => {
  const { usuario } = useUsuario();
  const navigate = useNavigate();
  const [ocs, setOcs] = useState([]);

  useEffect(() => {
    // Suscripción live a las OCs (puedes filtrar por estado si quieres afinar)
    const ref = collection(db, "ordenesCompra");
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOcs(data);
    });
    return () => unsub();
  }, []);

  const pendientes = useMemo(() => {
    if (!usuario) return 0;
    // Para roles de gerencia mostramos "pendientes para mí"
    if (isGerenciaRole(usuario.rol)) {
      return ocs.filter((oc) => ocPendingForRole(oc, usuario.rol, usuario.email)).length;
    }
    // Para otros, puedes elegir: 0 o pendientes globales; aquí dejamos 0
    return 0;
  }, [ocs, usuario]);

  if (!usuario) return null;

  // Solo mostramos si hay pendientes (y solo para gerencias)
  if (!isGerenciaRole(usuario.rol) || pendientes === 0) {
    return (
      <div
        title="Aprobaciones pend."
        className="hidden sm:flex items-center text-xs text-gray-500"
      >
        {/* Si quisieras ver siempre el badge, cambia el return anterior */}
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate("/historial?pendientes=1")}
      title="Ver pendientes de aprobación"
      className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 border border-amber-200 hover:bg-amber-200 transition"
      style={{ lineHeight: 1 }}
    >
      <AlertCircle size={16} />
      <span className="font-semibold">Pendientes</span>
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-xs">
        {pendientes}
      </span>
    </button>
  );
};

export default AprobacionesHeaderBadge;
