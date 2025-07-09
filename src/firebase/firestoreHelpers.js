import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  increment,
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
  const snapshot = await getDocs(collection(db, "proveedores"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Obtener centros de costo
export const obtenerCentrosCosto = async () => {
  const snapshot = await getDocs(collection(db, "centrosCosto"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Guardar nuevo centro de costo
export const guardarCentroCosto = async (centro) => {
  await addDoc(collection(db, "centrosCosto"), centro);
};

// Editar centro de costo
export const editarCentroCosto = async (id, nombre) => {
  await updateDoc(doc(db, "centrosCosto", id), { nombre });
};

// Eliminar centro de costo
export const eliminarCentroCosto = async (id) => {
  await deleteDoc(doc(db, "centrosCosto", id));
};

// Guardar nueva condición de pago
export const guardarCondicionPago = async (condicion) => {
  await addDoc(collection(db, "condicionesPago"), condicion);
};

// Obtener condiciones de pago
export const obtenerCondicionesPago = async () => {
  const snapshot = await getDocs(collection(db, "condicionesPago"));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Editar condiciones de pago
export const editarCondicionPago = async (id, nombre) => {
  await updateDoc(doc(db, "condicionesPago", id), { nombre });
};

// Eliminar condición de pago
export const eliminarCondicionPago = async (id) => {
  await deleteDoc(doc(db, "condicionesPago", id));
};

// Genera el número correlativo y guarda la OC
export const guardarOC = async (ocData) => {
  const correlativoRef = doc(db, "correlativos", "ordenesCompra");
  const correlativoSnap = await getDoc(correlativoRef);

  let nuevoNumero = 350;

  if (correlativoSnap.exists()) {
    const data = correlativoSnap.data();
    nuevoNumero = (data.ultimo || 349) + 1;
  }

  // Formato final
  const numeroOC = `MM-${String(nuevoNumero).padStart(6, "0")}`;

  const nuevaOC = {
    ...ocData,
    numeroOC,
  };

  const docRef = await addDoc(collection(db, "ordenesCompra"), nuevaOC);

  // Actualiza el último número usado
  await setDoc(correlativoRef, { ultimo: nuevoNumero }, { merge: true });

  return docRef.id;
};