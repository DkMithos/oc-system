// src/firebase/proveedoresHelpers.js
import { db } from "./config";
import { collection, getDocs, setDoc, doc, updateDoc } from "firebase/firestore";

const PROV_COLLECTION = "proveedores";

export const obtenerProveedores = async () => {
  const snap = await getDocs(collection(db, PROV_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

// Crea/actualiza por RUC como ID
export const agregarProveedor = async (proveedor) => {
  if (!proveedor?.ruc) throw new Error("RUC requerido");
  const ref = doc(db, PROV_COLLECTION, proveedor.ruc);
  await setDoc(ref, { ...proveedor, estado: proveedor.estado || "Activo" }, { merge: true });
  return ref.id;
};

export const actualizarProveedor = async (id, data) => {
  const ref = doc(db, PROV_COLLECTION, id);
  await updateDoc(ref, data);
  return id;
};
