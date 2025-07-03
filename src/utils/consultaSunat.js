// src/utils/consultaSunat.js
export const consultarSunat = async (ruc) => {
  const token = "free"; // Puedes reemplazarlo por uno propio si usas algún servicio externo pago
  const url = `https://api.apis.net.pe/v1/ruc?numero=${ruc}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error("Error consultando SUNAT");
  const data = await response.json();

  return {
    ruc: data.numeroDocumento,
    razonSocial: data.nombre,
    direccion: data.direccion,
  };
};

