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

      // Listener correcto: pásale un callback y guarda el unsubscribe
      unsubscribe = await onMessageListener((payload) => {
        console.log("[FCM foreground payload]", payload);
        const title =
          payload?.notification?.title || payload?.data?.title || "Notificación";
        const body =
          payload?.notification?.body || payload?.data?.body || "";
        alert(`🔔 Nueva notificación: ${title}\n${body}`);
      });
    })();

    return () => {
      try { unsubscribe(); } catch {}
    };
  }, [usuario?.email]);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Topbar toggleSidebar={toggleSidebar} />
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-30"
            onClick={toggleSidebar}
          />
        )}
        <div className="flex-1 overflow-y-auto p-4 z-10">
          <Outlet />
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Layout;
