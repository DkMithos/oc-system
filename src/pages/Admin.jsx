import React, { useEffect, useState } from "react";
import {
  obtenerUsuarios,
  guardarUsuario,
  eliminarUsuario,
  actualizarRolUsuario,
  actualizarPasswordUsuario,
  obtenerOCs,
  obtenerCotizaciones,
  obtenerProveedores,
  obtenerCentrosCosto,
  guardarCentroCosto,
  obtenerCondicionesPago,
  guardarCondicionPago,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";

import ResumenCards from "../components/admin/ResumenCards";
import GestorUsuarios from "../components/admin/GestorUsuarios";
import GestorCentrosCosto from "../components/admin/GestorCentrosCosto";
import GestorCondicionesPago from "../components/admin/GestorCondicionesPago";

const Admin = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [centros, setCentros] = useState([]);
  const [condiciones, setCondiciones] = useState([]);

  const currentUserEmail = localStorage.getItem("userEmail");

  useEffect(() => {
    const cargarDatos = async () => {
      const [usuariosDB, ocs, cotis, provs, cc, cp] = await Promise.all([
        obtenerUsuarios(),
        obtenerOCs(),
        obtenerCotizaciones(),
        obtenerProveedores(),
        obtenerCentrosCosto(),
        obtenerCondicionesPago(),
      ]);

      // Normaliza estado por si faltara
      setCentros((cc || []).map((c) => ({ ...c, estado: c.estado || "Activo" })));
      setCondiciones((cp || []).map((c) => ({ ...c, estado: c.estado || "Activo" })));

      setUsuarios(usuariosDB || []);
      setOrdenes(ocs || []);
      setCotizaciones(cotis || []);
      setProveedores(provs || []);
    };

    cargarDatos();
  }, []);

  // -----------------------------
  // CENTROS DE COSTO
  // -----------------------------
  const agregarCentroCosto = async (nombre) => {
    await guardarCentroCosto({ nombre, estado: "Activo", creadoEn: new Date().toISOString() });
    setCentros((await obtenerCentrosCosto()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({
      accion: "Agregar Centro de Costo",
      descripcion: `Centro creado: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  const cambiarEstadoCentro = async (centroId, nombre, nuevoEstado) => {
    const ref = doc(db, "centrosCosto", centroId);
    await updateDoc(ref, {
      estado: nuevoEstado,
      actualizadoEn: new Date().toISOString(),
    });
    setCentros((await obtenerCentrosCosto()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({
      accion: "Cambio de estado - Centro de Costo",
      descripcion: `Centro: ${nombre} → ${nuevoEstado}`,
      hechoPor: currentUserEmail,
    });
  };

  // -----------------------------
  // CONDICIONES DE PAGO
  // -----------------------------
  const agregarCondicionPago = async (nombre) => {
    await guardarCondicionPago({ nombre, estado: "Activo", creadoEn: new Date().toISOString() });
    setCondiciones((await obtenerCondicionesPago()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({
      accion: "Agregar Condición de Pago",
      descripcion: `Condición creada: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  const cambiarEstadoCondicion = async (condicionId, nombre, nuevoEstado) => {
    const ref = doc(db, "condicionesPago", condicionId);
    await updateDoc(ref, {
      estado: nuevoEstado,
      actualizadoEn: new Date().toISOString(),
    });
    setCondiciones((await obtenerCondicionesPago()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({
      accion: "Cambio de estado - Condición de Pago",
      descripcion: `Condición: ${nombre} → ${nuevoEstado}`,
      hechoPor: currentUserEmail,
    });
  };

  // -----------------------------
  // USUARIOS
  // -----------------------------
  const agregarUsuario = async (usuario) => {
    await guardarUsuario(usuario);
    setUsuarios(await obtenerUsuarios());
    await registrarLog({
      accion: "Agregar Usuario",
      descripcion: `Usuario agregado: ${usuario.email}, rol: ${usuario.rol}`,
      hechoPor: currentUserEmail,
    });
  };

  const eliminarUsuarioLocal = async (email) => {
    await eliminarUsuario(email);
    setUsuarios(await obtenerUsuarios());
    await registrarLog({
      accion: "Eliminar Usuario",
      descripcion: `Usuario eliminado: ${email}`,
      hechoPor: currentUserEmail,
    });
  };

  const actualizarRol = async (email, nuevoRol) => {
    await actualizarRolUsuario(email, nuevoRol);
    setUsuarios(await obtenerUsuarios());
    await registrarLog({
      accion: "Actualizar Rol",
      descripcion: `Usuario: ${email}, nuevo rol: ${nuevoRol}`,
      hechoPor: currentUserEmail,
    });
  };

  const cambiarEstadoUsuario = async (email, nuevoEstado, motivo) => {
    const ref = doc(db, "usuarios", email);
    await updateDoc(ref, { estado: nuevoEstado, motivoEstado: motivo || "", actualizadoEn: new Date().toISOString() });

    await registrarLog({
      accion: "Cambio de Estado de Usuario",
      descripcion: `Usuario: ${email}, nuevo estado: ${nuevoEstado}${motivo ? `, motivo: ${motivo}` : ""}`,
      hechoPor: currentUserEmail,
    });

    setUsuarios(await obtenerUsuarios());
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Panel de Administración</h2>

      <ResumenCards
        ordenes={ordenes}
        cotizaciones={cotizaciones}
        proveedores={proveedores}
      />

      <GestorCentrosCosto
        centros={centros}
        agregar={agregarCentroCosto}
        cambiarEstado={cambiarEstadoCentro}
      />

      <GestorCondicionesPago
        condiciones={condiciones}
        agregar={agregarCondicionPago}
        cambiarEstado={cambiarEstadoCondicion}
      />

      <GestorUsuarios
        usuarios={usuarios}
        agregarUsuario={agregarUsuario}
        eliminarUsuario={eliminarUsuarioLocal}
        cambiarRol={actualizarRol}
        cambiarEstadoUsuario={cambiarEstadoUsuario}
        roles={["admin", "comprador", "finanzas", "gerencia", "operaciones", "administración", "legal"]}
        actualizarPassword={actualizarPasswordUsuario}
      />
    </div>
  );
};

export default Admin;
