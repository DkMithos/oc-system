// src/pages/RecepcionBienes.jsx
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { ClipboardCheck, CheckCircle, AlertCircle, Clock, ChevronRight, X } from "lucide-react";
import { useUsuario } from "../context/UsuarioContext";
import { obtenerOCs } from "../firebase/firestoreHelpers";
import { crearRecepcion, obtenerRecepcionesPorOC } from "../firebase/recepcionHelpers";

// ── helpers ──────────────────────────────────────────────────
const normItem = (it) => ({
  nombre: it.nombre || it.descripcion || "Ítem sin nombre",
  cantidadOrdenada: Number(it.cantidad || it.cantidadOrdenada || 0),
  unidad: it.unidad || it.um || "UND",
});

const estadoBadge = (estado) => {
  if (estado === "Completo") return "bg-green-100 text-green-700";
  if (estado === "Parcial") return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
};

// ── componente ────────────────────────────────────────────────
const RecepcionBienes = () => {
  const { usuario } = useUsuario();

  const [ocs, setOcs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ocSeleccionada, setOcSeleccionada] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHist, setCargandoHist] = useState(false);

  // Formulario de recepción
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().slice(0, 10));
  const [observaciones, setObservaciones] = useState("");
  const [itemsRecepcion, setItemsRecepcion] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Filtro de búsqueda en lista OCs
  const [busqueda, setBusqueda] = useState("");

  // ── Carga OCs aprobadas / parciales ─────────────────────────
  useEffect(() => {
    (async () => {
      setCargando(true);
      try {
        const todas = await obtenerOCs();
        const elegibles = (todas || []).filter(
          (oc) =>
            oc.estado === "Aprobada" ||
            oc.recepcionEstado === "Parcial"
        );
        // Ordenar: parciales primero, luego por fecha desc
        elegibles.sort((a, b) => {
          if (a.recepcionEstado === "Parcial" && b.recepcionEstado !== "Parcial") return -1;
          if (b.recepcionEstado === "Parcial" && a.recepcionEstado !== "Parcial") return 1;
          return String(b.fechaEmision || "").localeCompare(String(a.fechaEmision || ""));
        });
        setOcs(elegibles);
      } catch (e) {
        console.error(e);
        toast.error("Error cargando órdenes.");
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  // ── Filtrado lista ───────────────────────────────────────────
  const ocsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ocs;
    return ocs.filter((oc) =>
      (oc.numero || oc.numeroOC || "").toLowerCase().includes(q) ||
      (oc.proveedor?.razonSocial || oc.proveedorNombre || "").toLowerCase().includes(q)
    );
  }, [ocs, busqueda]);

  // ── Seleccionar OC ───────────────────────────────────────────
  const seleccionarOC = async (oc) => {
    setOcSeleccionada(oc);
    setObservaciones("");
    setFechaRecepcion(new Date().toISOString().slice(0, 10));

    // Inicializar items de recepción
    const baseItems = (oc.items || []).map((it) => ({
      ...normItem(it),
      cantidadRecibida: 0,
      conforme: true,
      observacion: "",
    }));
    setItemsRecepcion(baseItems);

    // Cargar historial de recepciones
    setCargandoHist(true);
    try {
      const hist = await obtenerRecepcionesPorOC(oc.id);
      setHistorial(hist);
    } catch (e) {
      setHistorial([]);
    } finally {
      setCargandoHist(false);
    }
  };

  const cerrarForm = () => {
    setOcSeleccionada(null);
    setItemsRecepcion([]);
    setHistorial([]);
  };

  // ── Actualizar ítem de recepción ─────────────────────────────
  const updateItemRec = (idx, field, value) => {
    setItemsRecepcion((prev) => {
      const arr = [...prev];
      arr[idx] = { ...arr[idx], [field]: value };
      return arr;
    });
  };

  // [F-04] Detectar si la OC es de servicios (OS)
  const esServicio = ocSeleccionada?.tipoOrden === "OS";

  // ── Estado calculado ─────────────────────────────────────────
  const estadoCalculado = useMemo(() => {
    if (!itemsRecepcion.length) return "Parcial";
    if (esServicio) {
      // Para OS: "Completo" si todos los ítems están marcados como conformes
      return itemsRecepcion.every((it) => it.conforme) ? "Completo" : "Parcial";
    }
    const todoCompleto = itemsRecepcion.every(
      (it) => Number(it.cantidadRecibida) >= Number(it.cantidadOrdenada)
    );
    return todoCompleto ? "Completo" : "Parcial";
  }, [itemsRecepcion, esServicio]);

  const itemsCompletos = useMemo(() => {
    if (esServicio) return itemsRecepcion.filter((it) => it.conforme).length;
    return itemsRecepcion.filter((it) => Number(it.cantidadRecibida) >= Number(it.cantidadOrdenada)).length;
  }, [itemsRecepcion, esServicio]);

  // ── Guardar recepción ────────────────────────────────────────
  const confirmarRecepcion = async () => {
    // [F-04] Para servicios: requiere al menos un ítem confirmado; para bienes: al menos una cantidad
    const hayAlgo = esServicio
      ? itemsRecepcion.some((it) => it.conforme)
      : itemsRecepcion.some((it) => Number(it.cantidadRecibida) > 0);
    if (!hayAlgo) return toast.warning(
      esServicio ? "Marca al menos un servicio como confirmado." : "Ingresa al menos una cantidad recibida."
    );
    if (!fechaRecepcion) return toast.warning("Ingresa la fecha de recepción.");

    setGuardando(true);
    try {
      await crearRecepcion(ocSeleccionada.id, {
        ocNumero: ocSeleccionada.numero || ocSeleccionada.numeroOC || "",
        proveedorNombre: ocSeleccionada.proveedor?.razonSocial || ocSeleccionada.proveedorNombre || "",
        fechaRecepcion,
        recibidoPor: usuario.email,
        recibidoPorNombre: usuario.nombre || usuario.nombreCompleto || usuario.email,
        estado: estadoCalculado,
        observaciones,
        items: itemsRecepcion,
      });

      toast.success(`Recepción "${estadoCalculado}" registrada ✅`);

      // Actualizar OC en lista local
      setOcs((prev) =>
        prev.map((oc) =>
          oc.id === ocSeleccionada.id
            ? { ...oc, recepcionEstado: estadoCalculado, recepcionFecha: fechaRecepcion }
            : oc
        ).filter((oc) => estadoCalculado !== "Completo" || oc.id !== ocSeleccionada.id)
      );

      cerrarForm();
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar la recepción.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-green-100 p-2 rounded-lg"><ClipboardCheck className="text-green-600" size={24} /></div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recepción de Bienes y Servicios</h1>
          <p className="text-sm text-gray-500">Confirma la recepción de órdenes aprobadas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Panel izquierdo: lista de OCs ── */}
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Órdenes pendientes de recepción</h2>
            <input
              className="border rounded-lg px-3 py-2 w-full text-sm mb-3"
              placeholder="Buscar por N° orden o proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {cargando && <p className="text-sm text-gray-400 text-center py-4">Cargando órdenes…</p>}
            {!cargando && ocsFiltradas.length === 0 && (
              <div className="text-center py-6">
                <CheckCircle className="mx-auto text-green-400 mb-2" size={32} />
                <p className="text-sm text-gray-500">No hay órdenes pendientes de recepción.</p>
              </div>
            )}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {ocsFiltradas.map((oc) => {
                const numero = oc.numero || oc.numeroOC || oc.id;
                const proveedor = oc.proveedor?.razonSocial || oc.proveedorNombre || "—";
                const est = oc.recepcionEstado || "Sin recibir";
                const activa = ocSeleccionada?.id === oc.id;
                return (
                  <button
                    key={oc.id}
                    onClick={() => seleccionarOC(oc)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      activa
                        ? "border-blue-400 bg-blue-50 shadow-sm"
                        : "border-gray-200 hover:border-blue-200 hover:bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 text-sm">{numero}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${estadoBadge(est)}`}>{est}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{proveedor}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{oc.fechaEmision || ""}</span>
                      <ChevronRight size={14} className="text-gray-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Panel derecho: formulario ── */}
        <div className="lg:col-span-3">
          {!ocSeleccionada ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock size={40} className="mb-3 text-gray-300" />
              <p className="text-sm">Selecciona una orden de la lista para registrar su recepción</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">

              {/* Cabecera formulario */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">
                    {ocSeleccionada.numero || ocSeleccionada.numeroOC}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {ocSeleccionada.proveedor?.razonSocial || ocSeleccionada.proveedorNombre || "—"}
                  </p>
                </div>
                <button onClick={cerrarForm} className="text-gray-400 hover:text-gray-600 p-1"><X size={18} /></button>
              </div>

              {/* Estado summary */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                estadoCalculado === "Completo" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"
              }`}>
                {estadoCalculado === "Completo"
                  ? <CheckCircle size={16} />
                  : <AlertCircle size={16} />}
                {esServicio
                  ? <>{itemsCompletos} de {itemsRecepcion.length} servicios confirmados — Estado: <strong>{estadoCalculado}</strong></>
                  : <>{itemsCompletos} de {itemsRecepcion.length} ítems recibidos completamente — Estado: <strong>{estadoCalculado}</strong></>
                }
              </div>
              {/* [F-04] Badge tipo de orden */}
              {esServicio && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                  Orden de Servicio — confirma la prestación de cada servicio
                </div>
              )}

              {/* Fecha */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Recepción</label>
                  <input type="date" className="border rounded-lg p-2 w-full text-sm"
                    value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recibido por</label>
                  <input className="border rounded-lg p-2 w-full text-sm bg-gray-50" readOnly
                    value={usuario?.nombre || usuario?.nombreCompleto || usuario?.email || ""} />
                </div>
              </div>

              {/* Tabla ítems */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ítems de la orden</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {esServicio
                          ? ["Servicio","Cant.","UM","Confirmado","Observación"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                            ))
                          : ["Ítem","Ordenado","Recibido","UM","Conforme","Observación"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600">{h}</th>
                            ))
                        }
                      </tr>
                    </thead>
                    <tbody>
                      {itemsRecepcion.map((it, idx) => (
                        <tr key={idx} className={`border-t ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"}`}>
                          <td className="px-3 py-2 font-medium text-gray-800 max-w-[140px] truncate" title={it.nombre}>{it.nombre}</td>
                          <td className="px-3 py-2 text-center text-gray-600">{it.cantidadOrdenada}</td>
                          {!esServicio && (
                            <td className="px-3 py-2">
                              <input
                                type="number" min={0} max={it.cantidadOrdenada}
                                className={`border rounded px-2 py-1 w-20 text-right text-sm ${
                                  Number(it.cantidadRecibida) >= it.cantidadOrdenada
                                    ? "border-green-400 bg-green-50"
                                    : "border-gray-300"
                                }`}
                                value={it.cantidadRecibida}
                                onChange={(e) => updateItemRec(idx, "cantidadRecibida", Number(e.target.value))}
                              />
                            </td>
                          )}
                          <td className="px-3 py-2 text-gray-500">{it.unidad}</td>
                          <td className="px-3 py-2 text-center">
                            {/* [F-04] Para OS: checkbox es el control principal; para OC: solo flag de conformidad */}
                            <input
                              type="checkbox"
                              checked={it.conforme}
                              onChange={(e) => {
                                const val = e.target.checked;
                                updateItemRec(idx, "conforme", val);
                                // Para OS: sincronizar cantidadRecibida con la confirmación
                                if (esServicio) {
                                  updateItemRec(idx, "cantidadRecibida", val ? it.cantidadOrdenada : 0);
                                }
                              }}
                              className={`w-4 h-4 ${esServicio ? "accent-blue-600 w-5 h-5" : "accent-green-600"}`}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input className="border rounded px-2 py-1 w-full text-xs" placeholder="Observación..."
                              value={it.observacion}
                              onChange={(e) => updateItemRec(idx, "observacion", e.target.value)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observaciones generales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones generales</label>
                <textarea className="border rounded-lg p-2 w-full text-sm" rows={2}
                  placeholder="Condición de entrega, documentos recibidos, etc."
                  value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
              </div>

              {/* Acción */}
              <div className="flex justify-end">
                <button onClick={confirmarRecepcion} disabled={guardando}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold text-sm disabled:opacity-60">
                  <CheckCircle size={16} />
                  {guardando ? "Guardando..." : "Confirmar Recepción"}
                </button>
              </div>

              {/* Historial recepciones anteriores */}
              {(cargandoHist || historial.length > 0) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Historial de recepciones</h3>
                  {cargandoHist && <p className="text-xs text-gray-400">Cargando historial…</p>}
                  {!cargandoHist && historial.map((rec, i) => (
                    <div key={rec.id || i} className="flex items-center justify-between py-2 border-b last:border-b-0 text-sm">
                      <div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium mr-2 ${estadoBadge(rec.estado)}`}>{rec.estado}</span>
                        <span className="text-gray-700">{rec.fechaRecepcion}</span>
                        <span className="text-gray-400 ml-2">por {rec.recibidoPor}</span>
                      </div>
                      <span className="text-xs text-gray-400">{(rec.items || []).length} ítems</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecepcionBienes;
