// src/utils/errorReporting.js
// Fase 8: Captura centralizada de errores no manejados.
// Integrable con Sentry, Firebase Crashlytics o cualquier servicio.
//
// Uso: importar initErrorReporting() en main.jsx una sola vez.

import logger from "./logger";

/** Cola de errores para envío en batch (si se necesita) */
const errorQueue = [];
const MAX_QUEUE = 50;

/**
 * Reporta un error al servicio de monitoreo.
 * Hoy solo loguea; al integrar Sentry/Crashlytics, se envía aquí.
 */
export const reportError = (error, context = {}) => {
  const entry = {
    message: error?.message || String(error),
    stack: error?.stack || "",
    context,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
  };

  logger.error("[ErrorReport]", entry.message, context);

  // Almacenar en cola (útil para batch o debugging)
  if (errorQueue.length < MAX_QUEUE) {
    errorQueue.push(entry);
  }

  // === Integración futura ===
  // Sentry:   Sentry.captureException(error, { extra: context });
  // Firebase: crashlytics().recordError(error);
};

/**
 * Inicializa los listeners globales de errores.
 * Llamar UNA VEZ al inicio de la app (main.jsx).
 */
export const initErrorReporting = () => {
  // Errores JS no capturados
  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, {
      source: "window.onerror",
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Promesas rechazadas sin catch
  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason || "Unhandled Promise Rejection", {
      source: "unhandledrejection",
    });
  });
};

/** Devuelve los errores acumulados (útil para debug/export) */
export const getErrorQueue = () => [...errorQueue];
