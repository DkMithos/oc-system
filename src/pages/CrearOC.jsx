// ✅ src/pages/CrearOC.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Select from "react-select";
import Logo from "../assets/Logo_OC.png";
import { useUsuario } from "../context/UsuarioContext";

import {
  guardarOrden,
  obtenerSiguienteNumeroOrden,
  obtenerCentrosCosto,
  obtenerCondicionesPago,
  obtenerProveedores,
  registrarLog,
} from "../firebase/firestoreHelpers";
import { obtenerCotizaciones } from "../firebase/cotizacionesHelpers";
import { obtenerRequerimientosPorUsuario } from "../firebase/requerimientosHelpers";

const selectStyles = {
  control: (base) => ({
    ...base,
    minHeight: 36,
    borderColor: "#d1d5db",
    boxShadow: "none",
    ":hover": { borderColor: "#9ca3af" },
    fontSize: 14,
  }),
  valueContainer: (base) => ({ ...base, padding: "2px 8px" }),
  indicatorsContainer: (base) => ({ ...base, height: 32 }),
  menu: (base) => ({ ...base, zIndex: 50 }),
};

const CrearOC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario } = useUsuario();

  const preselect = location.state?.desdeCotizacion || null;

  const [proveedores, setProveedores] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [condicionesPago, setCondicionesPago] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]);

  const [bancosProveedor, setBancosProveedor] = useState([]);
  const [bancoSeleccionado, setBancoSeleccionado] = useState("");
  const [monedaSeleccionada, setMonedaSeleccionada] = useState("");
  const [cuentaSel, setCuentaSel] = useState(null);

  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tipoOrden: "OC",
    fechaEmision: new Date().toISOString().split("T")[0],

    proveedorId: null,
    condicionPagoId: null,
    centroCostoId: null,
    requerimientoId: null,
    requerimientoCodigo: "",
    cotizacionId: null,
    cotizacionCodigo: "",

    lugarEntrega: "",
    plazoEntrega: "",

    responsable: usuario?.nombre || "",
    creadoPor: usuario?.email || "",
    notas: "",

    items: [],
  });

  const totals = useMemo(() => {
    const sub = form.items.reduce(
      (acc, it) =>
        acc +
        (Number(it.cantidad || 0) * Number(it.pu || 0) -
          Number(it.dscto || 0)),
      0
    );
    const igv = Math.round(sub * 0.18 * 100) / 100;
    const total = Math.round((sub + igv) * 100) / 100;
    return { sub, igv, total };
  }, [form.items]);

  useEffect(() => {
    (async () => {
      try {
        const [prov, cc, cp, correl, cots, rqs] = await Promise.all([
          obtenerProveedores(),
          obtenerCentrosCosto(),
          obtenerCondicionesPago(),
          obtenerSiguienteNumeroOrden(),
          obtenerCotizaciones(),
          obtenerRequerimientosPorUsuario(usuario?.email || ""),
        ]);

        setProveedores(
          (prov || []).map((p) => ({
            value: p.id ?? p.ruc ?? p.email ?? p.razonSocial,
            label: `${p.ruc || ""} ${p.razonSocial || p.nombre || ""}`.trim(),
            raw: p,
          }))
        );
        setCentrosCosto(
          (cc || []).map((c) => ({ value: c.id, label: c.nombre, raw: c }))
        );
        setCondicionesPago(
          (cp || []).map((c) => ({ value: c.id, label: c.nombre, raw: c }))
        );

        setCotizaciones(cots || []);
        setRequerimientos(rqs || []);
        setNumero(correl?.numero || correl?.numeroOC || "");

        if (preselect?.cotizacionId) {
          const cot = (cots || []).find((x) => x.id === preselect.cotizacionId);
          if (cot) {
            const mappedItems = (cot.items || []).map((it) => ({
              codigo: it.codigo || "",
              descripcion: it.nombre || "",
              cantidad: Number(it.cantidad || 0),
              um: it.unidad || "UND",
              pu: Number(it.precioUnitario || 0),
              dscto: Number(it.descuento || 0),
            }));

            const rqObj =
              (rqs || []).find((r) => r.id === (cot.requerimientoId || "")) ||
              null;

            setForm((f) => ({
              ...f,
              cotizacionId: cot.id,
              cotizacionCodigo: cot.codigo || "",
              requerimientoId: rqObj?.id || f.requerimientoId,
              requerimientoCodigo: rqObj?.codigo || f.requerimientoCodigo,
              items: mappedItems.length ? mappedItems : f.items,
            }));
          }
        }
      } catch (e) {
        console.error(e);
        setError("Error cargando datos iniciales.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proveedorOpt = useMemo(
    () => proveedores.find((p) => p.value === form.proveedorId) || null,
    [proveedores, form.proveedorId]
  );

  useEffect(() => {
    const bancos = proveedorOpt?.raw?.bancos || [];
    setBancosProveedor(bancos);
    setBancoSeleccionado("");
    setMonedaSeleccionada("");
    setCuentaSel(null);
  }, [proveedorOpt?.value]); // eslint-disable-line

  const bancosUnicos = useMemo(() => {
    const names = new Set(
      (bancosProveedor || []).map((b) => b.nombre).filter(Boolean)
    );
    return Array.from(names);
  }, [bancosProveedor]);

  const monedasDelBanco = useMemo(() => {
    return (bancosProveedor || [])
      .filter((b) => b.nombre === bancoSeleccionado)
      .map((b) => b.moneda)
      .filter(Boolean);
  }, [bancosProveedor, bancoSeleccionado]);

  useEffect(() => {
    if (!bancoSeleccionado || !monedaSeleccionada) {
      setCuentaSel(null);
      return;
    }
    const found =
      (bancosProveedor || []).find(
        (b) => b.nombre === bancoSeleccionado && b.moneda === monedaSeleccionada
      ) || null;
    setCuentaSel(found);
  }, [bancosProveedor, bancoSeleccionado, monedaSeleccionada]);

  const handleChange = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const agregarItem = () =>
    setForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { codigo: "", descripcion: "", cantidad: 1, um: "UND", pu: 0, dscto: 0 },
      ],
    }));
  const actualizarItem = (i, k, v) =>
    setForm((f) => {
      const items = [...f.items];
      items[i] = { ...items[i], [k]: v };
      return { ...f, items };
    });
  const eliminarItem = (i) =>
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const cotizacionOptions = useMemo(() => {
    const list = cotizaciones || [];
    return list.map((c) => ({
      value: c.id,
      label: `${c.codigo || "(s/cód)"}`,
      raw: c,
    }));
  }, [cotizaciones, proveedores]);

  const handleSeleccionCotizacion = (opt) => {
    if (!opt) {
      setForm((f) => ({
        ...f,
        cotizacionId: null,
        cotizacionCodigo: "",
      }));
      return;
    }
    const c = opt.raw;
    const mappedItems = (c.items || []).map((it) => ({
      codigo: it.codigo || "",
      descripcion: it.nombre || "",
      cantidad: Number(it.cantidad || 0),
      um: it.unidad || "UND",
      pu: Number(it.precioUnitario || 0),
      dscto: Number(it.descuento || 0),
    }));

    const rqObj = (requerimientos || []).find(
      (r) => r.id === (c.requerimientoId || "")
    );

    setForm((f) => ({
      ...f,
      cotizacionId: c.id,
      cotizacionCodigo: c.codigo || "",
      requerimientoId: rqObj?.id || f.requerimientoId,
      requerimientoCodigo: rqObj?.codigo || f.requerimientoCodigo,
      items: mappedItems.length ? mappedItems : f.items,
    }));
  };

  const rqOptions = useMemo(() => {
    const list = requerimientos || [];
    return list.map((r) => ({
      value: r.id,
      label: r.codigo || r.id,
      raw: r,
    }));
  }, [requerimientos]);

  const handleSeleccionRQ = (opt) => {
    if (!opt) {
      setForm((f) => ({ ...f, requerimientoId: null, requerimientoCodigo: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      requerimientoId: opt.value,
      requerimientoCodigo: opt.raw?.codigo || "",
    }));
  };

  const validar = () => {
    if (!form.tipoOrden) return "Selecciona el tipo de orden.";
    if (!numero) return "No se pudo obtener el correlativo.";
    if (form.items.length === 0) return "Agrega al menos un ítem.";

    if (form.tipoOrden !== "OI") {
      if (!form.proveedorId) return "Selecciona un proveedor.";
      if (!form.cotizacionId) return "Selecciona la cotización.";
      if (!form.requerimientoId) return "Selecciona el requerimiento.";
      if (!bancoSeleccionado) return "Selecciona el banco del proveedor.";
      if (!monedaSeleccionada) return "Selecciona la moneda para el pago.";
      if (!cuentaSel?.cuenta) return "No se encontró la cuenta del proveedor.";
    }
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validar();
    if (v) return setError(v);

    setGuardando(true);
    try {
      const items = form.items.map((it) => ({
        codigo: it.codigo || "",
        nombre: it.descripcion || "",
        cantidad: Number(it.cantidad || 0),
        unidad: it.um || "UND",
        precioUnitario: Number(it.pu || 0),
        descuento: Number(it.dscto || 0),
      }));

      const proveedorObj = proveedorOpt?.raw || null;

      const payload = {
        numeroOC: numero,
        tipoOrden: form.tipoOrden,
        fechaEmision: form.fechaEmision,

        requerimientoId: form.requerimientoId || "",
        requerimiento: form.requerimientoCodigo || "",
        cotizacionId: form.cotizacionId || "",
        cotizacion: form.cotizacionCodigo || "",

        centroCosto:
          centrosCosto.find((c) => c.value === form.centroCostoId)?.label || "",
        condicionPago:
          condicionesPago.find((c) => c.value === form.condicionPagoId)?.label ||
          "",

        proveedor: proveedorObj
          ? {
              ruc: proveedorObj.ruc || "",
              razonSocial: proveedorObj.razonSocial || proveedorObj.nombre || "",
              direccion: proveedorObj.direccion || "",
              telefono: proveedorObj.telefono || "",
              email: proveedorObj.email || "",
              contacto: proveedorObj.contacto || "",
              bancos: proveedorObj.bancos || [],
            }
          : null,

        bancoSeleccionado: form.tipoOrden !== "OI" ? bancoSeleccionado : "",
        monedaSeleccionada:
          form.tipoOrden !== "OI" ? monedaSeleccionada : "Soles",
        cuenta:
          form.tipoOrden !== "OI"
            ? { cuenta: cuentaSel?.cuenta || "", cci: cuentaSel?.cci || "" }
            : null,

        lugarEntrega: form.lugarEntrega || "",
        plazoEntrega: form.plazoEntrega || "",

        responsable: form.responsable || "",
        creadoPor: usuario?.email || form.creadoPor || "",
        // 👇🏽 ¡El campo faltante!
        notas: form.notas || "",

        items,
        resumen: {
          subtotal: totals.sub,
          igv: totals.igv,
          otros: 0,
          total: totals.sub + totals.igv,
        },

        permiteEdicion: false,
        historial: [
          {
            accion: "Creación",
            por: usuario?.email || "",
            fecha: new Date().toLocaleString("es-PE"),
          },
        ],
      };

      const id = await guardarOrden(payload);
      await registrarLog("ui_crear_orden", id, usuario?.email || "");

      navigate(`/ver?id=${id}`, { state: { orden: { id, ...payload } } });
    } catch (e2) {
      console.error(e2);
      setError(e2?.message || "Error al guardar la orden.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-4">
        <img src={Logo} alt="Memphis" className="h-10" />
        <h1 className="text-xl font-semibold">Generar Orden</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded mb-3">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Correlativo & Tipo & Fecha */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">N° de Orden</label>
            <input value={numero} readOnly className="border rounded w-full px-2 py-1 bg-gray-50" />
          </div>
          <div>
            <label className="block text-sm font-medium">Tipo de Orden</label>
            <select
              value={form.tipoOrden}
              onChange={(e) => handleChange("tipoOrden", e.target.value)}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="OC">Orden de Compra (OC)</option>
              <option value="OS">Orden de Servicio (OS)</option>
              <option value="OI">Orden Interna (OI)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Fecha de Emisión</label>
            <input
              type="date"
              value={form.fechaEmision}
              onChange={(e) => handleChange("fechaEmision", e.target.value)}
              className="border rounded w-full px-2 py-1"
            />
          </div>
        </div>

        {/* RQ / Cotización */}
        {form.tipoOrden !== "OI" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Requerimiento</label>
              <Select
                styles={selectStyles}
                options={rqOptions}
                value={rqOptions.find((o) => o.value === form.requerimientoId) || null}
                onChange={handleSeleccionRQ}
                placeholder="Selecciona requerimiento (muestra código)..."
                isClearable
                isSearchable
              />
              {form.requerimientoCodigo && (
                <p className="text-xs text-gray-500 mt-1">
                  Seleccionado: <b>{form.requerimientoCodigo}</b>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium">Cotización</label>
              <Select
                styles={selectStyles}
                options={cotizacionOptions}
                value={cotizacionOptions.find((o) => o.value === form.cotizacionId) || null}
                onChange={handleSeleccionCotizacion}
                placeholder="Selecciona cotización..."
                isClearable
                isSearchable
              />
              {form.cotizacionCodigo && (
                <p className="text-xs text-gray-500 mt-1">
                  Seleccionada: <b>{form.cotizacionCodigo}</b>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Proveedor / Condición / Centro de Costo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Proveedor</label>
            {form.tipoOrden === "OI" ? (
              <input readOnly placeholder="No aplica para OI" className="border rounded w-full px-2 py-1 bg-gray-50" />
            ) : (
              <Select
                styles={selectStyles}
                options={proveedores}
                value={proveedores.find((p) => p.value === form.proveedorId) || null}
                onChange={(opt) => handleChange("proveedorId", opt?.value || null)}
                placeholder="Selecciona proveedor..."
                isClearable
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium">Condición de Pago</label>
            <Select
              styles={selectStyles}
              options={condicionesPago}
              value={condicionesPago.find((p) => p.value === form.condicionPagoId) || null}
              onChange={(opt) => handleChange("condicionPagoId", opt?.value || null)}
              placeholder="Selecciona condición..."
              isClearable
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Centro de Costo</label>
            <Select
              styles={selectStyles}
              options={centrosCosto}
              value={centrosCosto.find((c) => c.value === form.centroCostoId) || null}
              onChange={(opt) => handleChange("centroCostoId", opt?.value || null)}
              placeholder="Selecciona centro de costo..."
              isClearable
            />
          </div>
        </div>

        {/* Banco / Moneda / Cuenta */}
        {form.tipoOrden !== "OI" && proveedorOpt && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium">Banco</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={bancoSeleccionado}
                onChange={(e) => {
                  setBancoSeleccionado(e.target.value);
                  setMonedaSeleccionada("");
                }}
              >
                <option value="">Selecciona banco</option>
                {bancosUnicos.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium">Moneda</label>
              <select
                className="border rounded px-2 py-1 w-full"
                value={monedaSeleccionada}
                onChange={(e) => setMonedaSeleccionada(e.target.value)}
                disabled={!bancoSeleccionado}
              >
                <option value="">Selecciona moneda</option>
                {monedasDelBanco.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <div className="text-xs text-gray-600">
                {cuentaSel ? (
                  <>
                    <div><b>Cuenta:</b> {cuentaSel.cuenta || "—"}</div>
                    <div><b>CCI:</b> {cuentaSel.cci || "—"}</div>
                  </>
                ) : (
                  <span>Cuenta/CCI aparecerán aquí</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ítems */}
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Detalle del Pedido</h2>
            <button type="button" onClick={agregarItem} className="px-3 py-1 border rounded hover:bg-gray-50">
              + Agregar ítem
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Código</th>
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-right p-2">Cant.</th>
                  <th className="text-left p-2">U.M.</th>
                  <th className="text-right p-2">P.U.</th>
                  <th className="text-right p-2">Dscto</th>
                  <th className="text-right p-2">Subtotal</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {form.items.map((it, i) => {
                  const subtotal = Math.max(
                    0,
                    Number(it.cantidad || 0) * Number(it.pu || 0) -
                      Number(it.dscto || 0)
                  );
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <input className="border rounded px-2 py-1 w-full" value={it.codigo}
                          onChange={(e) => actualizarItem(i, "codigo", e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded px-2 py-1 w-full" value={it.descripcion}
                          onChange={(e) => actualizarItem(i, "descripcion", e.target.value)} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" min="0" className="border rounded px-2 py-1 w-24 text-right" value={it.cantidad}
                          onChange={(e) => actualizarItem(i, "cantidad", e.target.value)} />
                      </td>
                      <td className="p-2">
                        <input className="border rounded px-2 py-1 w-20" value={it.um}
                          onChange={(e) => actualizarItem(i, "um", e.target.value)} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" min="0" step="0.01" className="border rounded px-2 py-1 w-28 text-right" value={it.pu}
                          onChange={(e) => actualizarItem(i, "pu", e.target.value)} />
                      </td>
                      <td className="p-2 text-right">
                        <input type="number" min="0" step="0.01" className="border rounded px-2 py-1 w-28 text-right" value={it.dscto}
                          onChange={(e) => actualizarItem(i, "dscto", e.target.value)} />
                      </td>
                      <td className="p-2 text-right">{subtotal.toFixed(2)}</td>
                      <td className="p-2 text-right">
                        <button type="button" className="text-red-600 hover:underline" onClick={() => eliminarItem(i)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {form.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-6">Sin ítems</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div className="md:col-span-2" />
            <div className="text-right">
              <div className="text-sm">SubTotal: <strong>{totals.sub.toFixed(2)}</strong></div>
              <div className="text-sm">IGV (18%): <strong>{totals.igv.toFixed(2)}</strong></div>
              <div className="text-base">Total: <strong>{(totals.sub + totals.igv).toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        {/* Entrega / Notas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Lugar de Entrega/Ejecución</label>
            <input value={form.lugarEntrega} onChange={(e) => handleChange("lugarEntrega", e.target.value)}
              className="border rounded px-2 py-1 w-full" placeholder="Ej. Almacén central / Dirección" />
          </div>
          <div>
            <label className="block text-sm font-medium">Plazo de Entrega</label>
            <input value={form.plazoEntrega} onChange={(e) => handleChange("plazoEntrega", e.target.value)}
              className="border rounded px-2 py-1 w-full" placeholder="Ej. 7 días hábiles" />
          </div>
          <div>
            <label className="block text-sm font-medium">Responsable</label>
            <input value={form.responsable} onChange={(e) => handleChange("responsable", e.target.value)}
              className="border rounded px-2 py-1 w-full" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => handleChange("notas", e.target.value)}
            className="border rounded px-2 py-1 w-full"
            rows={3}
            placeholder="Garantías, penalidades u observaciones"
          />
        </div>

        <div className="flex gap-2">
          <button type="submit" disabled={guardando}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
            {guardando ? "Guardando..." : "Generar Orden"}
          </button>
          <button type="button" className="px-4 py-2 rounded border" onClick={() => navigate(-1)}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
};

export default CrearOC;
