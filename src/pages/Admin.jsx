import React, { useEffect, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";

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
  const { usuario, cargando } = useUsuario();

  const [usuariosList, setUsuariosList] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [centros, setCentros] = useState([]);
  const [condiciones, setCondiciones] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(true);

  const currentUserEmail = usuario?.email || localStorage.getItem("userEmail") || "";

  useEffect(() => {
    if (cargando) return;
    if (!usuario) { setLoadingPanel(false); return; }

    (async () => {
      try {
        const results = await Promise.allSettled([
          obtenerUsuarios(),
          obtenerOCs(),
          obtenerCotizaciones(),    // si esta falla, no tumba el panel
          obtenerProveedores(),
          obtenerCentrosCosto(),
          obtenerCondicionesPago(),
        ]);

        const pick = (i) => results[i].status === "fulfilled" ? results[i].value : [];

        const usuariosDB = pick(0);
        const ocs        = pick(1);
        const cotis      = pick(2);
        const provs      = pick(3);
        const cc         = pick(4);
        const cp         = pick(5);

        setUsuariosList(usuariosDB);
        setOrdenes(ocs);
        setCotizaciones(cotis);
        setProveedores(provs);
        setCentros(cc.map((c) => ({ ...c, estado: c.estado || "Activo" })));
        setCondiciones(cp.map((c) => ({ ...c, estado: c.estado || "Activo" })));

        // loguea cuál falló para depurar si algo queda vacío
        results.forEach((r, idx) => {
          if (r.status === "rejected") {
            const nombre = ["usuarios","ordenes","cotizaciones","proveedores","centros","condiciones"][idx];
            console.warn(`⚠️ ${nombre}:`, r.reason?.message || r.reason);
          }
        });
      } finally {
        setLoadingPanel(false);
      }
    })();
  }, [cargando, usuario?.email]);


  // ----------------------------- CENTROS DE COSTO
  const agregarCentroCosto = async (nombre) => {
    await guardarCentroCosto({ nombre, estado: "Activo", creadoEn: new Date().toISOString() });
    setCentros((await obtenerCentrosCosto()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({ accion: "Agregar Centro de Costo", descripcion: `Centro creado: ${nombre}`, hechoPor: currentUserEmail });
  };

  const cambiarEstadoCentro = async (centroId, nombre, nuevoEstado) => {
    const ref = doc(db, "centrosCosto", centroId);
    await updateDoc(ref, { estado: nuevoEstado, actualizadoEn: new Date().toISOString() });
    setCentros((await obtenerCentrosCosto()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({ accion: "Cambio de estado - Centro de Costo", descripcion: `Centro: ${nombre} → ${nuevoEstado}`, hechoPor: currentUserEmail });
  };

  // ----------------------------- CONDICIONES DE PAGO
  const agregarCondicionPago = async (nombre) => {
    await guardarCondicionPago({ nombre, estado: "Activo", creadoEn: new Date().toISOString() });
    setCondiciones((await obtenerCondicionesPago()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({ accion: "Agregar Condición de Pago", descripcion: `Condición creada: ${nombre}`, hechoPor: currentUserEmail });
  };

  const cambiarEstadoCondicion = async (condicionId, nombre, nuevoEstado) => {
    const ref = doc(db, "condicionesPago", condicionId);
    await updateDoc(ref, { estado: nuevoEstado, actualizadoEn: new Date().toISOString() });
    setCondiciones((await obtenerCondicionesPago()).map((c) => ({ ...c, estado: c.estado || "Activo" })));
    await registrarLog({ accion: "Cambio de estado - Condición de Pago", descripcion: `Condición: ${nombre} → ${nuevoEstado}`, hechoPor: currentUserEmail });
  };

  // ----------------------------- USUARIOS
  const agregarUsuarioHandler = async (usuarioNuevo) => {
    await guardarUsuario(usuarioNuevo);
    setUsuariosList(await obtenerUsuarios());
    await registrarLog({ accion: "Agregar Usuario", descripcion: `Usuario agregado: ${usuarioNuevo.email}, rol: ${usuarioNuevo.rol}`, hechoPor: currentUserEmail });
  };

  const eliminarUsuarioLocal = async (email) => {
    await eliminarUsuario(email);
    setUsuariosList(await obtenerUsuarios());
    await registrarLog({ accion: "Eliminar Usuario", descripcion: `Usuario eliminado: ${email}`, hechoPor: currentUserEmail });
  };

  const actualizarRol = async (email, nuevoRol) => {
    await actualizarRolUsuario(email, nuevoRol);
    setUsuariosList(await obtenerUsuarios());
    await registrarLog({ accion: "Actualizar Rol", descripcion: `Usuario: ${email}, nuevo rol: ${nuevoRol}`, hechoPor: currentUserEmail });
  };

  const cambiarEstadoUsuario = async (email, nuevoEstado, motivo) => {
    const ref = doc(db, "usuarios", email);
    await updateDoc(ref, { estado: nuevoEstado, motivoEstado: motivo || "", actualizadoEn: new Date().toISOString() });
    await registrarLog({ accion: "Cambio de Estado de Usuario", descripcion: `Usuario: ${email}, nuevo estado: ${nuevoEstado}${motivo ? `, motivo: ${motivo}` : ""}`, hechoPor: currentUserEmail });
    setUsuariosList(await obtenerUsuarios());
  };

  if (loadingPanel) return <div className="p-6">Cargando panel…</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Panel de Administración</h2>

      <ResumenCards ordenes={ordenes} cotizaciones={cotizaciones} proveedores={proveedores} />

      <GestorCentrosCosto centros={centros} agregar={agregarCentroCosto} cambiarEstado={cambiarEstadoCentro} />

      <GestorCondicionesPago condiciones={condiciones} agregar={agregarCondicionPago} cambiarEstado={cambiarEstadoCondicion} />

      <GestorUsuarios
        usuarios={usuariosList}
        agregarUsuario={agregarUsuarioHandler}
        eliminarUsuario={eliminarUsuarioLocal}
        cambiarRol={actualizarRol}
        cambiarEstadoUsuario={cambiarEstadoUsuario}
        roles={["admin","comprador","finanzas","gerencia","operaciones","administracion","legal","soporte"]}
        actualizarPassword={actualizarPasswordUsuario}
      />
    </div>
  );
};

export default Admin;
