import { db } from "./config";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const PROV_COLLECTION = "proveedores";

// Listar todos los proveedores
export const obtenerProveedores = async () => {
  const snapshot = await getDocs(collection(db, PROV_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Agregar nuevo proveedor
export const agregarProveedor = async (proveedor) => {
  return await addDoc(collection(db, PROV_COLLECTION), proveedor);
};

// Actualizar proveedor
export const actualizarProveedor = async (id, data) => {
  const ref = doc(db, PROV_COLLECTION, id);
  return await updateDoc(ref, data);
};

// Eliminar proveedor
export const eliminarProveedor = async (id) => {
  const ref = doc(db, PROV_COLLECTION, id);
  return await deleteDoc(ref);
};
