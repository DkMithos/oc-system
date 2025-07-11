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
        const data = await obtenerUsuarioActual();
        setUsuario(data);
      } else {
        setUsuario(null);
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
