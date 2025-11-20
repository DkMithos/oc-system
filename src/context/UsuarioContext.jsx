//src/context/UsuarioContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { obtenerUsuarioActual } from "../firebase/usuariosHelpers";
import { solicitarPermisoYObtenerToken } from "../firebase/fcm";

const UsuarioContext = createContext();

export const UsuarioProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const wasSignedOut = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const data = await obtenerUsuarioActual();
          if (data?.email && data?.rol) {
            setUsuario(data);
            localStorage.setItem("userEmail", data.email);
            localStorage.setItem("userRole", data.rol);
            localStorage.setItem("userName", data.nombre || "");
          } else {
            setUsuario(null);
            localStorage.clear();
          }
        } catch {
          setUsuario(null);
          localStorage.clear();
        }
        setCargando(false);
      } else {
        setUsuario(null);
        localStorage.clear();
        if (cerrandoSesion) {
          setTimeout(() => {
            setCerrandoSesion(false);
            setCargando(false);
          }, 900);
        } else {
          setCargando(false);
        }
      }
    });
    return () => unsub();
  }, [cerrandoSesion]);

  // 🔔 Registrar token FCM al iniciar sesión (silencioso, pide permiso si es necesario)
  useEffect(() => {
    const run = async () => {
      if (!usuario?.email) return;
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "default") {
          try {
            await Notification.requestPermission();
          } catch {}
        }
        const email = usuario.email.toLowerCase().trim();
        await solicitarPermisoYObtenerToken(email);
      } catch {
        // No romper la UX si falla FCM
      }
    };
    run();
  }, [usuario?.email]);

  const cerrarSesion = async () => {
    if (wasSignedOut.current) return;
    setCerrandoSesion(true);
    setCargando(true);
    wasSignedOut.current = true;
    try {
      await signOut(auth);
    } catch {
      setCerrandoSesion(false);
      setCargando(false);
    }
    setTimeout(() => {
      wasSignedOut.current = false;
    }, 2000);
  };

  if (cargando || cerrandoSesion) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-white z-50">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xl text-[#004990] font-bold animate-pulse">
            {cerrandoSesion ? "Cerrando sesión..." : "Cargando usuario..."}
          </span>
          <div className="w-16 h-1.5 bg-[#004990] rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <UsuarioContext.Provider value={{ usuario, cargando, cerrarSesion }}>
      {children}
    </UsuarioContext.Provider>
  );
};

export const useUsuario = () => useContext(UsuarioContext);
