// ✅ src/pages/Home.jsx
import React from "react";
import { useUsuario } from "../context/UsuarioContext";
import TestNotificacion from "../components/TestNotificacion";

const Home = () => {
  const { usuario } = useUsuario();

  const guiasPorRol = {
    admin: [
      "Gestiona usuarios y permisos desde el panel de administración.",
      "Accede al historial completo de OCs.",
      "Administra los módulos maestros y logs."
    ],
    comprador: [
      "Crea nuevas órdenes de compra.",
      "Edita OCs rechazadas.",
      "Consulta el historial y estado de tus OCs."
    ],
    operaciones: [
      "Aprueba o rechaza OCs en estado 'Pendiente de Operaciones'.",
      "Revisa los detalles antes de firmar.",
      "Gestiona el control de Caja Chica"
    ],
    gerencia: [
      "Firma OCs aprobadas por operaciones.",
      "Consulta órdenes en estado 'Aprobado por Operaciones'."
    ],
    finanzas: [
      "Registra pagos.",
      "Consulta el historial financiero de cada OC."
    ]
  };

  const guias = guiasPorRol[usuario?.rol] || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-[#004990] mb-4">
        Bienvenido, {usuario?.nombre || usuario?.email}
      </h1>

      <p className="text-gray-700 mb-6">
        Este es tu panel principal. A continuación encontrarás una guía rápida para tu rol: <strong>{usuario?.rol?.toUpperCase()}</strong>
      </p>

      <ul className="list-disc list-inside mb-6 text-gray-800 space-y-2">
        {guias.length > 0 ? (
          guias.map((g, i) => <li key={i}>✅ {g}</li>)
        ) : (
          <li>No se ha definido una guía específica para tu rol.</li>
        )}
      </ul>

      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded">
        ¿Necesitas ayuda? Escríbenos a:{" "}
        <a
          href="mailto:soporte@memphis.pe"
          className="underline text-blue-700"
        >
          soporte@memphis.pe
        </a>
      </div>
    </div>
  );
};

export default Home;
