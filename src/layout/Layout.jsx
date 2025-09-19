// src/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import { useUsuario } from "../context/UsuarioContext";
import { solicitarPermisoYObtenerToken, onMessageListener } from "../firebase/fcm";

const Layout = () => {
  const { usuario } = useUsuario();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!usuario?.email) return;

    let unsubscribe = () => {};

    (async () => {
      const token = await solicitarPermisoYObtenerToken(usuario.email);
      if (token) {
        console.log("Token FCM listo para", usuario.email);
      } else {
        console.warn("No se pudo obtener el token de FCM");
      }

      // Suscripción a notificaciones en primer plano
      try {
        unsubscribe = await onMessageListener((payload) => {
          console.log("[FCM foreground payload]", payload);
          const title =
            payload?.notification?.title || payload?.data?.title || "Notificación";
          const body =
            payload?.notification?.body || payload?.data?.body || "";
          alert(`🔔 Nueva notificación:\n${title}\n${body}`);
        });
      } catch (e) {
        console.error("No se pudo suscribir a onMessage:", e);
      }
    })();

    return () => {
      try {
        unsubscribe && unsubscribe();
      } catch {}
    };
  }, [usuario?.email]);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    // ⬇️ min-h-screen (no h-screen) y SIN scroll interno: deja que el body scrollee
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Topbar toggleSidebar={toggleSidebar} />

      {/* Contenedor principal sin overflow-hidden para permitir scroll de la página */}
      <div className="flex flex-1 relative">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        {/* Overlay para cerrar sidebar en móvil */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={toggleSidebar}
          />
        )}

        {/* ⬇️ Contenido sin overflow-y-auto para que el footer quede al final real del documento */}
        <div className="flex-1 p-4 z-10">
          <Outlet />
        </div>
      </div>

      {/* El Footer ya no es fijo; aparece al final del documento */}
      <Footer />
    </div>
  );
};

export default Layout;
