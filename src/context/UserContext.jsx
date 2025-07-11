import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/config";
import { obtenerUsuarioActual } from "../firebase/usuariosHelpers";

// 1. Crear el contexto
const UserContext = createContext();

// 2. Proveedor del contexto
export const UserProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const datos = await obtenerUsuarioActual();
        setUsuario(datos || null);
      } else {
        setUsuario(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ usuario, loading }}>
      {children}
    </UserContext.Provider>
  );
};

// 3. Hook para usar el contexto
export const useUsuario = () => useContext(UserContext);
