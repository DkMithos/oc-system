// src/firebase/firmasHelpers.js
import { db } from "./config";
import { doc, getDoc, setDoc } from "firebase/firestore";

export const obtenerFirmaGuardada = async (email) => {
  const ref = doc(db, "firmas", email);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().firma : null;
};

export const guardarFirmaUsuario = async (email, firmaDataUrl) => {
  const ref = doc(db, "firmas", email);
  await setDoc(ref, { email, firma: firmaDataUrl }, { merge: true });
};
