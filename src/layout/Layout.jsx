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
  useEffect(() => {
    if (usuario?.email) {
      solicitarPermisoYObtenerToken()
        .then((token) => {
          if (token) {
            guardarTokenFCM(token); // <--- ESTA ES LA CORRECCIÓN CLAVE
            console.log("Token FCM guardado para", usuario.email);
          } else {
            console.warn("No se pudo obtener el token de FCM");
          }
        });

      // Notificaciones en primer plano (push visual, ejemplo: toast)
      const unsubscribe = onMessageListener().then((payload) => {
        alert(`🔔 Nueva notificación: ${payload.notification?.title}\n${payload.notification?.body}`);
        // Puedes aquí reemplazar el alert por un toast, panel, sonido, etc.
      });

      // No es necesario cleanup porque onMessageListener es solo un wrapper de promesa
      // Si necesitas más control, investiga con EventEmitter o Redux para centralizarlo

      // return undefined;
    }
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
