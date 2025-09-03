// src/layout/Layout.jsx
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import Footer from "../components/Footer";
import { useUsuario } from "../context/UsuarioContext";
import { solicitarPermisoYObtenerToken, guardarTokenFCM, onMessageListener } from "../firebase/fcm";

const Layout = () => {
  const { usuario } = useUsuario();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Guardar token FCM y escuchar notificaciones solo si hay usuario autenticado
  // src/layout/Layout.jsx (dentro del useEffect)
  useEffect(() => {
    if (!usuario?.email) return;

    solicitarPermisoYObtenerToken(usuario.email).then((token) => {
      if (token) {
        console.log("Token FCM listo para", usuario.email);
      } else {
        console.warn("No se pudo obtener el token de FCM");
      }
    });

    // Normalizador de payloads (notification || data)
    const norm = (p) => ({
      title:
        p?.notification?.title ||
        p?.data?.title ||
        "Notificación",
      body:
        p?.notification?.body ||
        p?.data?.body ||
        "",
      ocId: p?.data?.ocId || null,
    });

    const unsub = onMessageListener().then((payload) => {
      console.log("[FCM foreground payload]", payload);
      const { title, body } = norm(payload);
      alert(`🔔 Nueva notificación: ${title}\n${body}`);
      // Si prefieres, en lugar de alert, delega a un sistema de toasts o a tu <Notificaciones/>
    });

    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [usuario]);


  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* TOPBAR */}
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
