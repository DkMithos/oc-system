// src/components/Notificaciones.jsx
import React, { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { onMessageListener } from "../firebase/fcm";
import { useNavigate } from "react-router-dom";

const SONIDO = "/sonidos/notif.mp3"; // Ruta en public

const Notificaciones = () => {
  const [notificaciones, setNotificaciones] = useState(() => {
    const guardadas = localStorage.getItem("notificaciones");
    return guardadas ? JSON.parse(guardadas) : [];
  });
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const audioRef = useRef(null);

  // Guardar en localStorage al actualizar
  useEffect(() => {
    localStorage.setItem("notificaciones", JSON.stringify(notificaciones));
  }, [notificaciones]);

  useEffect(() => {
    onMessageListener().then((payload) => {
      // SONIDO
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }

      const nueva = {
        id: Date.now(),
        titulo: payload.notification?.title,
        cuerpo: payload.notification?.body,
        fecha: new Date().toLocaleString(),
        leida: false,
        ocId: payload?.data?.ocId || null,
      };
      setNotificaciones((prev) => [nueva, ...prev]);
    });
  }, []);

  const marcarComoLeida = (id) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  };

  const marcarTodasComoLeidas = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const verOC = (ocId, idNotif) => {
    marcarComoLeida(idNotif);
    setAbierto(false);
    if (ocId) navigate(`/ver?id=${ocId}`);
  };

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="relative">
      {/* audio elemento oculto */}
      <audio src={SONIDO} ref={audioRef} preload="auto" />
      <button
        className="relative p-2 rounded-full hover:bg-blue-100"
        onClick={() => setAbierto((v) => !v)}
        title="Ver notificaciones"
      >
        <Bell size={22} className="text-white" />
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
            {noLeidas}
          </span>
        )}
      </button>
      {/* Panel de notificaciones */}
      {abierto && (
        <div className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center p-2 font-semibold text-blue-900 border-b">
            <span>Notificaciones</span>
            <button
              className="text-xs text-blue-600 underline"
              onClick={marcarTodasComoLeidas}
            >
              Marcar todas como leídas
            </button>
          </div>
          {notificaciones.length === 0 ? (
            <div className="p-4 text-gray-500">No hay notificaciones</div>
          ) : (
            notificaciones.map((n, i) => (
              <div
                key={n.id}
                className={`p-3 border-b last:border-0 cursor-pointer ${n.leida ? "bg-gray-100" : "bg-blue-50"}`}
                onClick={() => {
                  if (n.ocId) verOC(n.ocId, n.id);
                  else marcarComoLeida(n.id);
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm">{n.titulo}</span>
                  {!n.leida && <span className="text-[9px] bg-blue-600 text-white rounded-full px-2 ml-2">Nuevo</span>}
                </div>
                <div className="text-xs">{n.cuerpo}</div>
                <div className="text-xs text-gray-400 mt-1">{n.fecha}</div>
                {n.ocId && (
                  <button
                    className="mt-1 text-xs text-blue-700 underline"
                    onClick={e => {
                      e.stopPropagation();
                      verOC(n.ocId, n.id);
                    }}
                  >
                    Ver OC
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
