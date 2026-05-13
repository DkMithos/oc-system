// src/firebase/proveedoresHelpers.js
import { db } from "./config";
import { collection, getDocs, setDoc, doc, updateDoc, addDoc } from "firebase/firestore";

const PROV_COLLECTION = "proveedores";

export const obtenerProveedores = async () => {
  const snap = await getDocs(collection(db, PROV_COLLECTION));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

/**
 * Crea un proveedor.
 * - Domiciliado: usa RUC como document ID (como siempre).
 * - No domiciliado: genera un ID automático (no tiene RUC peruano).
 */
export const agregarProveedor = async (proveedor) => {
  const esNoDomiciliado = proveedor.tipoProv === "No Domiciliado";

  if (!esNoDomiciliado && !proveedor?.ruc) {
    throw new Error("RUC requerido para proveedores domiciliados");
  }

  const payload = { ...proveedor, estado: proveedor.estado || "Activo" };

  if (esNoDomiciliado) {
    // No domiciliado: ID automático
    const colRef = collection(db, PROV_COLLECTION);
    const docRef = await addDoc(colRef, payload);
    return docRef.id;
  } else {
    // Domiciliado: RUC como ID (behavior original)
    const ref = doc(db, PROV_COLLECTION, proveedor.ruc);
    await setDoc(ref, payload, { merge: true });
    return ref.id;
  }
};

export const actualizarProveedor = async (id, data) => {
  const ref = doc(db, PROV_COLLECTION, id);
  await updateDoc(ref, data);
  return id;
};
