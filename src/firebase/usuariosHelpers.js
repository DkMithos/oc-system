//src/firebase/usuariosHelpers.js
import { db } from "./config";
import { doc, getDoc } from "firebase/firestore";
import { auth } from "./config";

export const obtenerUsuarioActual = async () => {
  const user = auth.currentUser;
  if (!user) return null;

  const ref = doc(db, "usuarios", user.email);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return snap.data(); // { nombre, rol, email, ... }
};

export const cambiarEstadoUsuario = async (email, nuevoEstado, motivo) => {
  const ref = doc(db, "usuarios", email);
  await updateDoc(ref, {
    estado: nuevoEstado,
    motivoEstado: motivo,
    actualizadoEn: new Date().toISOString(),
  });
};
