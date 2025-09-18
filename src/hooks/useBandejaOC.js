// src/hooks/useBandejaOC.js
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Devuelve contadores de OCs según el rol del usuario y un "miBandeja"
 * que indica cuántas requieren acción del rol actual.
 *
 * Estados estándar usados en tu app:
 * - "Pendiente de Firma del Comprador"
 * - "Pendiente de Operaciones"
 * - "Aprobado por Operaciones"
 * - "Aprobado por Gerencia"
 */
export const useBandejaOC = (rol) => {
  const [counts, setCounts] = useState({
    comprador: 0,
    operaciones: 0,
    gerencia: 0,
    finanzas: 0,
  });

  useEffect(() => {
    // Un listener por estado simple (barato y en tiempo real)
    const qComprador = query(
      collection(db, "ordenesCompra"),
      where("estado", "==", "Pendiente de Firma del Comprador")
    );
    const qOperaciones = query(
      collection(db, "ordenesCompra"),
      where("estado", "==", "Pendiente de Operaciones")
    );
    const qGerencia = query(
      collection(db, "ordenesCompra"),
      where("estado", "==", "Aprobado por Operaciones")
    );
    const qFinanzas = query(
      collection(db, "ordenesCompra"),
      where("estado", "==", "Aprobado por Gerencia")
    );

    const unsubs = [
      onSnapshot(qComprador, (snap) =>
        setCounts((p) => ({ ...p, comprador: snap.size }))
      ),
      onSnapshot(qOperaciones, (snap) =>
        setCounts((p) => ({ ...p, operaciones: snap.size }))
      ),
      onSnapshot(qGerencia, (snap) =>
        setCounts((p) => ({ ...p, gerencia: snap.size }))
      ),
      onSnapshot(qFinanzas, (snap) =>
        setCounts((p) => ({ ...p, finanzas: snap.size }))
      ),
    ];

    return () => unsubs.forEach((u) => u && u());
  }, []);

  const miBandeja = useMemo(() => {
    switch (rol) {
      case "comprador":
        return { estado: "Pendiente de Firma del Comprador", cantidad: counts.comprador };
      case "operaciones":
        return { estado: "Pendiente de Operaciones", cantidad: counts.operaciones };
      case "gerencia":
        return { estado: "Aprobado por Operaciones", cantidad: counts.gerencia };
      case "finanzas":
        return { estado: "Aprobado por Gerencia", cantidad: counts.finanzas };
      default:
        // admin u otros: suma total de pendientes de flujo
        return {
          estado: "Pendientes",
          cantidad: counts.comprador + counts.operaciones + counts.gerencia + counts.finanzas,
        };
    }
  }, [rol, counts]);

  return { counts, miBandeja };
};
