import React, { useEffect, useState } from "react";
import {
  obtenerUsuarios,
  guardarUsuario,
  eliminarUsuario,
  actualizarRolUsuario,
  obtenerOCs,
  obtenerCotizaciones,
  obtenerProveedores,
  obtenerCentrosCosto,
  guardarCentroCosto,
  eliminarCentroCosto,
  obtenerCondicionesPago,
  guardarCondicionPago,
  eliminarCondicionPago,
  registrarLog,
} from "../firebase/firestoreHelpers";

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

      setUsuarios(usuariosDB);
      setOrdenes(ocs);
      setCotizaciones(cotis);
      setProveedores(provs);
      setCentros(cc);
      setCondiciones(cp);
    };

    cargarDatos();
  }, []);

  // ACCIONES CENTROS DE COSTO
  const agregarCentroCosto = async (nombre) => {
    await guardarCentroCosto({ nombre });
    setCentros(await obtenerCentrosCosto());
    await registrarLog({
      accion: "Agregar Centro de Costo",
      descripcion: `Centro creado: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  const eliminarCentro = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar centro de costo "${nombre}"?`)) return;
    await eliminarCentroCosto(id);
    setCentros(await obtenerCentrosCosto());
    await registrarLog({
      accion: "Eliminar Centro de Costo",
      descripcion: `Centro eliminado: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  // ACCIONES CONDICIONES DE PAGO
  const agregarCondicionPago = async (nombre) => {
    await guardarCondicionPago({ nombre });
    setCondiciones(await obtenerCondicionesPago());
    await registrarLog({
      accion: "Agregar Condición de Pago",
      descripcion: `Condición creada: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  const eliminarCondicion = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar condición de pago "${nombre}"?`)) return;
    await eliminarCondicionPago(id);
    setCondiciones(await obtenerCondicionesPago());
    await registrarLog({
      accion: "Eliminar Condición de Pago",
      descripcion: `Condición eliminada: ${nombre}`,
      hechoPor: currentUserEmail,
    });
  };

  // ACCIONES USUARIOS
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
        eliminar={eliminarCentro}
      />

      <GestorCondicionesPago
        condiciones={condiciones}
        agregar={agregarCondicionPago}
        eliminar={eliminarCondicion}
      />

      <GestorUsuarios
        usuarios={usuarios}
        agregar={agregarUsuario}
        eliminar={eliminarUsuarioLocal}
        cambiarRol={actualizarRol}
      />
    </div>
  );
};

export default Admin;
