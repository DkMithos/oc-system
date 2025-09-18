// src/firebase/indicadoresHelpers.js
import { collection, getDocs } from "firebase/firestore";
import { db } from "./config";

// Usuarios
export const obtenerUsuarios = async () => {
  const ref = collection(db, "usuarios");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
};

// Logs (opcional)
export const obtenerLogs = async () => {
  const ref = collection(db, "logs");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => doc.data());
};

// Exportaciones (opcional)
export const obtenerExportaciones = async () => {
  const ref = collection(db, "exportaciones");
  const snap = await getDocs(ref);
  return snap.docs.map((doc) => doc.data());
};
