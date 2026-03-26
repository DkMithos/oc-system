// src/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
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
      // Registro silencioso del token FCM — sin console.log en producción
      await solicitarPermisoYObtenerToken(usuario.email.toLowerCase().trim()).catch(() => null);

      // Notificaciones en primer plano: toast en lugar de alert bloqueante
      try {
        unsubscribe = await onMessageListener((payload) => {
          const title = payload?.notification?.title || payload?.data?.title || "Notificación";
          const body  = payload?.notification?.body  || payload?.data?.body  || "";
          toast.info(`${title}${body ? `\n${body}` : ""}`, {
            position: "top-right",
            autoClose: 6000,
          });
        });
      } catch {
        // FCM no disponible en este navegador — silencioso
      }
    })();

    return () => {
      try { unsubscribe && unsubscribe(); } catch {}
    };
  }, [usuario?.email]);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Topbar toggleSidebar={toggleSidebar} />

      <div className="flex flex-1 relative">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />

        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30"
            onClick={toggleSidebar}
          />
        )}

        <div className="flex-1 p-4 z-10">
          <Outlet />
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Layout;
