// src/utils/tipoCambio.js
// Fase 8: Usa Cloud Function con caché Firestore. Fallback directo a API si CF falla.

import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/config";

const TC_DEFAULT = 3.8;
let _cachedTC = null;
let _cachedAt = 0;
const LOCAL_TTL = 5 * 60 * 1000; // 5 min de caché local en memoria

export const obtenerTipoCambio = async () => {
  // Caché local para evitar llamadas repetidas en la misma sesión
  if (_cachedTC && Date.now() - _cachedAt < LOCAL_TTL) {
    return _cachedTC;
  }

  // 1. Intentar Cloud Function (tiene caché Firestore de 6h)
  try {
    const functions = getFunctions(app, "us-central1");
    const fn = httpsCallable(functions, "obtenerTipoCambioSUNAT");
    const { data } = await fn();
    if (data?.venta > 0) {
      _cachedTC = data.venta;
      _cachedAt = Date.now();
      return data.venta;
    }
  } catch {
    // Cloud Function no disponible, fallback directo
  }

  // 2. Fallback: API directa (solo si CF falló)
  try {
    const response = await fetch("https://api.apis.net.pe/v1/tipo-cambio-sunat");
    const data = await response.json();
    const venta = parseFloat(data.venta);
    if (venta > 0) {
      _cachedTC = venta;
      _cachedAt = Date.now();
      return venta;
    }
  } catch {
    // API directa también falló
  }

  return TC_DEFAULT;
};
