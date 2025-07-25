// ✅ src/context/UsuarioContext.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { obtenerUsuarioActual } from "../firebase/usuariosHelpers";

const UsuarioContext = createContext();

export const UsuarioProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

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
        } catch (error) {
          console.error("Error cargando usuario:", error);
          setUsuario(null);
          localStorage.clear();
        }
      } else {
        setUsuario(null);
        localStorage.clear();
      }

      setCargando(false);
    });

    return () => unsub();
  }, []);

  return (
    <UsuarioContext.Provider value={{ usuario, cargando }}>
      {children}
    </UsuarioContext.Provider>
  );
};

export const useUsuario = () => useContext(UsuarioContext);
