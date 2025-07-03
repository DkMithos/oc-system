// src/utils/formatearMoneda.js

export const formatearMoneda = (monto, moneda = "Soles") => {
  const currency = moneda === "Dólares" ? "USD" : "PEN";

  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(monto || 0);
};
