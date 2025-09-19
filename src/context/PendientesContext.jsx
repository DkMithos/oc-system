import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useUsuario } from "./UsuarioContext";
import { ocPendingForRole, isGerenciaRole } from "../utils/aprobaciones";

/**
 * Estructura:
 * - total: número de OCs pendientes para el usuario logueado (según su rol)
 * - pendientes: array de OCs pendientes (ya normalizadas desde Firestore)
 * - loading: estado de carga
 * - refresh: fuerza el recálculo (vuelve a enganchar la suscripción)
 */
const Ctx = createContext({
  total: 0,
  pendientes: [],
  loading: true,
  refresh: () => {},
});

export const PendientesProvider = ({ children }) => {
  const { usuario } = useUsuario();
  const [loading, setLoading] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [total, setTotal] = useState(0);

  // Para poder “refrescar” manualmente la suscripción si lo necesitas
  const refreshFlag = useRef(0);
  const refresh = () => {
    refreshFlag.current += 1;
    setLoading(true);
  };

  useEffect(() => {
    // Si no hay usuario, limpiamos y no nos suscribimos
    if (!usuario) {
      setPendientes([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    // Nos suscribimos a todas las OCs; si esto es pesado, podrías filtrar por campos.
    const ref = collection(db, "ordenesCompra");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const ocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Para roles aprobadores calculamos sus pendientes; otros roles → 0
        let lista = [];
        if (isGerenciaRole(usuario.rol)) {
          lista = ocs.filter((oc) => ocPendingForRole(oc, usuario.rol, usuario.email));
        } else {
          // puedes decidir mostrar otros pendientes; por ahora 0 para no “ensuciar” el header
          lista = [];
        }

        setPendientes(lista);
        setTotal(lista.length);
        setLoading(false);
      },
      (err) => {
        console.error("[PendientesContext] onSnapshot error:", err);
        setPendientes([]);
        setTotal(0);
        setLoading(false);
      }
    );

    return () => unsub();
    // Se vuelve a enganchar si cambia el rol/email o si llamas a refresh()
  }, [usuario?.rol, usuario?.email, refreshFlag.current]);

  const value = useMemo(
    () => ({ total, pendientes, loading, refresh }),
    [total, pendientes, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const usePendientes = () => useContext(Ctx);
