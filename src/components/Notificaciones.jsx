// src/components/Notificaciones.jsx
import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { onMessageListener } from "../firebase/fcm";
import { useNavigate } from "react-router-dom";

const SONIDO = "/sonidos/notif.mp3";
const LS_KEY = "notificaciones";
const LS_MUTED = "notificaciones_muted";
const MAX_GUARDADAS = 100;

const normalizePayload = (p = {}) => {
  const title =
    p?.notification?.title || p?.data?.title || "Notificación";
  const body =
    p?.notification?.body || p?.data?.body || "";
  const ocId = p?.data?.ocId || null;
  // En foreground, FCM normalmente NO trae fcmOptions.link; usamos data.link/url si existiera
  const link = p?.data?.link || p?.data?.url || (ocId ? `/ver?id=${ocId}` : null);

  return { title, body, ocId, link };
};

const Notificaciones = () => {
  const navigate = useNavigate();

  const [notificaciones, setNotificaciones] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });

  const [abierto, setAbierto] = useState(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(LS_MUTED) === "1";
    } catch {
      return false;
    }
  });

  const contenedorRef = useRef(null);
  const audioRef = useRef(null);

  // Persistencia
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(notificaciones.slice(0, MAX_GUARDADAS)));
    } catch {}
  }, [notificaciones]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_MUTED, muted ? "1" : "0");
    } catch {}
  }, [muted]);

  // Click fuera para cerrar el panel
  useEffect(() => {
    if (!abierto) return;
    const handler = (e) => {
      if (!contenedorRef.current) return;
      if (!contenedorRef.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [abierto]);

  // Suscripción a FCM (foreground)
  useEffect(() => {
    let off = () => {};
    (async () => {
      off = await onMessageListener((payload) => {
        const np = normalizePayload(payload);

        if (!muted && audioRef.current) {
          try {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => {});
          } catch {}
        }

        const nueva = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          titulo: np.title,
          cuerpo: np.body,
          fecha: new Date().toLocaleString("es-PE"),
          leida: false,
          ocId: np.ocId || null,
          link: np.link || null,
        };

        setNotificaciones((prev) => [nueva, ...prev].slice(0, MAX_GUARDADAS));
      });
    })();

    return () => {
      try {
        off && off();
      } catch {}
    };
  }, [muted]);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  const marcarComoLeida = (id) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n))
    );
  };

  const marcarTodasComoLeidas = () => {
    setNotificaciones((prev) => prev.map((n) => ({ ...n, leida: true })));
  };

  const limpiarTodo = () => {
    if (!window.confirm("¿Borrar todas las notificaciones?")) return;
    setNotificaciones([]);
  };

  const irA = (link) => {
    try {
      const url = new URL(link, window.location.origin);
      const mismoOrigen = url.origin === window.location.origin;
      if (mismoOrigen) {
        navigate(url.pathname + url.search + url.hash);
      } else {
        window.open(url.href, "_blank", "noopener,noreferrer");
      }
    } catch {
      // Si falla el parseo, intenta navegar como ruta relativa
      if (link?.startsWith("/")) navigate(link);
      else if (link) window.open(link, "_blank", "noopener,noreferrer");
    }
  };

  const abrirNotificacion = (n) => {
    marcarComoLeida(n.id);
    setAbierto(false);
    if (n.ocId) {
      navigate(`/ver?id=${n.ocId}`);
    } else if (n.link) {
      irA(n.link);
    }
  };

  return (
    <div className="relative" ref={contenedorRef}>
      <audio src={SONIDO} ref={audioRef} preload="auto" />

      <button
        className="relative p-2 rounded-full hover:bg-blue-100"
        onClick={() => setAbierto((v) => !v)}
        title="Ver notificaciones"
        aria-label="Notificaciones"
      >
        <Bell size={22} className="text-white" />
        {noLeidas > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white border rounded shadow-lg z-50 max-h-96 overflow-y-auto"
          role="dialog"
          aria-label="Panel de notificaciones"
        >
          <div className="flex items-center justify-between p-2 border-b">
            <div className="font-semibold text-blue-900">Notificaciones</div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-blue-600 underline"
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Quitar silencio" : "Silenciar sonido"}
              >
                {muted ? "Sonido: off" : "Sonido: on"}
              </button>
              <button
                className="text-xs text-blue-600 underline"
                onClick={marcarTodasComoLeidas}
                title="Marcar todas como leídas"
              >
                Marcar leídas
              </button>
              <button
                className="text-xs text-red-600 underline"
                onClick={limpiarTodo}
                title="Limpiar todo"
              >
                Limpiar
              </button>
            </div>
          </div>

          {notificaciones.length === 0 ? (
            <div className="p-4 text-gray-500">No hay notificaciones</div>
          ) : (
            notificaciones.map((n) => (
              <div
                key={n.id}
                className={`p-3 border-b last:border-0 cursor-pointer ${
                  n.leida ? "bg-gray-50" : "bg-blue-50"
                }`}
                onClick={() => abrirNotificacion(n)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{n.titulo}</div>
                    <div className="text-xs text-gray-700 whitespace-pre-wrap">
                      {n.cuerpo}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      {n.fecha}
                    </div>
                  </div>
                  {!n.leida && (
                    <span className="text-[9px] bg-blue-600 text-white rounded-full px-2 shrink-0">
                      Nuevo
                    </span>
                  )}
                </div>

                {(n.ocId || n.link) && (
                  <div className="mt-2">
                    <button
                      className="text-xs text-blue-700 underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirNotificacion(n);
                      }}
                    >
                      {n.ocId ? "Ver OC" : "Abrir"}
                    </button>
                  </div>
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
