// src/components/TestNotificacion.jsx
import React from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useUsuario } from "../context/UsuarioContext";

const TestNotificacion = () => {
  const { usuario } = useUsuario();

  const enviar = async () => {
    try {
      if (!usuario?.email) {
        console.warn("Sin usuario logueado");
        return;
      }
      const email = usuario.email.toLowerCase().trim();
      const functions = getFunctions(undefined, "us-central1");
      const enviarTest = httpsCallable(functions, "enviarNotificacionTest");

      const res = await enviarTest({
        email,
        ocId: "TEST",
        title: "Prueba de notificación",
        body: "Si ves esto, FCM está OK",
      });

      console.log("Respuesta enviarNotificacionTest:", res.data);
    } catch (e) {
      console.error("Error enviando notificación de prueba:", e);
    }
  };

  return (
    <button
      type="button"
      onClick={enviar}
      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white"
    >
      Test notificación FCM
    </button>
  );
};

export default TestNotificacion;
