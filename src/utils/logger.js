// src/utils/logger.js
// Logger condicional: solo emite en desarrollo. En producción no contamina la consola.
// Fase 7 — Consolidación + Limpieza

const isDev = import.meta.env.DEV;

const logger = {
  log: (...args) => { if (isDev) console.log(...args); },
  warn: (...args) => { if (isDev) console.warn(...args); },
  error: (...args) => { console.error(...args); }, // errores siempre visibles
  info: (...args) => { if (isDev) console.info(...args); },
  debug: (...args) => { if (isDev) console.debug(...args); },
};

export default logger;
