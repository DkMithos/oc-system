// src/utils/tipoCambio.js
export const obtenerTipoCambio = async () => {
  try {
    const response = await fetch("https://api.apis.net.pe/v1/tipo-cambio-sunat");
    const data = await response.json();
    return parseFloat(data.venta); // Usamos el valor de venta
  } catch (error) {
    console.error("Error al obtener tipo de cambio", error);
    return 3.8; // Valor por defecto
  }
};
