import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "./config";

const OC_COLLECTION = "ordenesCompra";
const USUARIOS_COLLECTION = "usuarios";
const LOGS_COLLECTION = "logs";
const COTIZACIONES_COLLECTION = "cotizaciones";
const PROVEEDORES_COLLECTION = "proveedores";

// ✅ Usuarios
export const obtenerUsuarios = async () => {
  const snapshot = await getDocs(collection(db, USUARIOS_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const guardarUsuario = async (usuario) => {
  await setDoc(doc(db, USUARIOS_COLLECTION, usuario.email), usuario);
};

export const eliminarUsuario = async (email) => {
  await deleteDoc(doc(db, USUARIOS_COLLECTION, email));
};

export const actualizarRolUsuario = async (email, nuevoRol) => {
  const ref = doc(db, USUARIOS_COLLECTION, email);
  await updateDoc(ref, { rol: nuevoRol });
};

// ✅ Logs
export const registrarLog = async ({ accion, descripcion, hechoPor }) => {
  await addDoc(collection(db, LOGS_COLLECTION), {
    accion,
    descripcion,
    hechoPor,
    fecha: serverTimestamp(),
  });
};

export const obtenerLogs = async () => {
  const snapshot = await getDocs(collection(db, LOGS_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ Órdenes de Compra
export const guardarOC = async (orden) => {
  const ref = await addDoc(collection(db, OC_COLLECTION), orden);
  return ref.id;
};

export const obtenerOCs = async () => {
  const snapshot = await getDocs(collection(db, OC_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const obtenerOCporId = async (id) => {
  const ref = doc(db, OC_COLLECTION, id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const actualizarOC = async (id, nuevaData) => {
  const ref = doc(db, OC_COLLECTION, id);
  await updateDoc(ref, nuevaData);
};

// ✅ Cotizaciones
export const obtenerCotizaciones = async () => {
  const snapshot = await getDocs(collection(db, COTIZACIONES_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// ✅ Proveedores
export const obtenerProveedores = async () => {
  const snapshot = await getDocs(collection(db, PROVEEDORES_COLLECTION));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};


