// ✅ src/context/UsuarioContext.jsx
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { obtenerUsuarioActual } from "../firebase/usuariosHelpers";

const UsuarioContext = createContext();

export const UsuarioProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  // Ref para evitar doble ejecución de cierre
  const wasSignedOut = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      // Si está en cierre, mantenemos el loader con el mensaje correspondiente
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
        } catch (error) {
          setUsuario(null);
          localStorage.clear();
        }
        setCargando(false);
      } else {
        setUsuario(null);
        localStorage.clear();
        // Solo mostrar "Cerrando sesión..." si fue acción explícita
        if (cerrandoSesion) {
          setTimeout(() => {
            setCerrandoSesion(false);
            setCargando(false);
          }, 900); // Puedes ajustar el tiempo (milisegundos)
        } else {
          setCargando(false);
        }
      }
    });
    return () => unsub();
  }, [cerrandoSesion]);

  // Esta función la usas para cerrar sesión desde tu botón/logout
  const cerrarSesion = async () => {
    if (wasSignedOut.current) return; // previene doble click
    setCerrandoSesion(true);
    setCargando(true);
    wasSignedOut.current = true;
    try {
      await signOut(auth);
    } catch {
      setCerrandoSesion(false);
      setCargando(false);
    }
    setTimeout(() => { wasSignedOut.current = false; }, 2000); // evita spam
  };

  // Loader centralizado
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
