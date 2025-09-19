// src/context/PendientesContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useUsuario } from "./UsuarioContext";
import { ocPendingForRole, isApprovalRole } from "../utils/aprobaciones";

const PendientesContext = createContext({ total: 0, ocs: 0, solicitudes: 0, loading: true });

export const PendientesProvider = ({ children }) => {
  const { usuario } = useUsuario();
  const [ocs, setOcs] = useState([]);
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);

  const aprobador = !!usuario && isApprovalRole(usuario.rol);

  useEffect(() => {
    if (!usuario) {
      setOcs([]);
      setSolicitudes([]);
      setLoading(false);
      return;
    }

    // 1) OCs (escucha global)
    const unsub1 = onSnapshot(collection(db, "ordenesCompra"), (snap) => {
      setOcs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // 2) Solicitudes de edición pendientes (solo si es aprobador)
    let unsub2 = () => {};
    if (aprobador) {
      const qSol = query(collectionGroup(db, "solicitudesEdicion"), where("estado", "==", "pendiente"));
      unsub2 = onSnapshot(qSol, (snap) => setSolicitudes(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    } else {
      setSolicitudes([]);
    }

    setLoading(false);
    return () => {
      try { unsub1(); } catch {}
      try { unsub2(); } catch {}
    };
  }, [usuario, aprobador]);

  const countOCs = useMemo(() => {
    if (!usuario) return 0;
    return ocs.filter((oc) => ocPendingForRole(oc, usuario.rol, usuario.email)).length;
  }, [ocs, usuario]);

  const countSolicitudes = useMemo(() => (aprobador ? solicitudes.length : 0), [aprobador, solicitudes]);

  const value = useMemo(
    () => ({ total: countOCs + countSolicitudes, ocs: countOCs, solicitudes: countSolicitudes, loading }),
    [countOCs, countSolicitudes, loading]
  );

  return <PendientesContext.Provider value={value}>{children}</PendientesContext.Provider>;
};

export const usePendientes = () => useContext(PendientesContext);
