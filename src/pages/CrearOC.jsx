// ✅ src/pages/CrearOC.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ItemTable from "../components/ItemTable";
import Logo from "../assets/Logo_OC.png";
import Select from "react-select";
import { useUsuario } from "../context/UsuarioContext";

import {
  guardarOrden,                     // nuevo: guarda OC/OS/OI con correlativo único
  obtenerSiguienteNumeroOrden,      // nuevo: correlativo único MM-000001...
  obtenerCentrosCosto,
  obtenerCondicionesPago,
  obtenerProveedores,
  registrarLog,
  // Si ya tienes helpers para requerimientos / cotizaciones, impórtalos aquí:
  // obtenerRequerimientos, obtenerCotizaciones
} from "../firebase/firestoreHelpers";

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
  const { usuario } = useUsuario();

  // Datos de maestros
  const [proveedores, setProveedores] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [condicionesPago, setCondicionesPago] = useState([]);
  const [requerimientos, setRequerimientos] = useState([]); // opcional
  const [cotizaciones, setCotizaciones] = useState([]);     // opcional

  // Estado de formulario
  const [numero, setNumero] = useState(""); // correlativo
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tipoOrden: "OC", // "OC" | "OS" | "OI"
    fechaEmision: new Date().toISOString().split("T")[0],
    moneda: "PEN",
    igv: 0.18,
    proveedorId: null,
    condicionPagoId: null,
    centroCostoId: null,
    requerimientoId: null,
    cotizacionId: null,
    notas: "",
    lugarEntrega: "",
    plazoEntrega: "",
    responsable: usuario?.nombre || "",
    creadoPor: usuario?.email || "",
    items: [], // [{codigo, descripcion, cantidad, um, pu, dscto, subtotal}]
  });

  // Totales
  const totals = useMemo(() => {
    const sub = form.items.reduce((acc, it) => acc + (Number(it.cantidad || 0) * Number(it.pu || 0) - Number(it.dscto || 0)), 0);
    const igvMonto = Math.round(sub * Number(form.igv || 0) * 100) / 100;
    const total = Math.round((sub + igvMonto) * 100) / 100;
    return { sub, igvMonto, total };
  }, [form.items, form.igv]);

  // Cargar maestros y correlativo
  useEffect(() => {
    (async () => {
      try {
        const [prov, cc, cp] = await Promise.all([
          obtenerProveedores(),
          obtenerCentrosCosto(),
          obtenerCondicionesPago(),
        ]);

        setProveedores((prov || []).map(p => ({ value: p.id, label: p.razonSocial || p.nombre, raw: p })));
        setCentrosCosto((cc || []).map(c => ({ value: c.id, label: c.nombre, raw: c })));
        setCondicionesPago((cp || []).map(c => ({ value: c.id, label: c.nombre, raw: c })));

        // Si tienes helpers de requerimientos y cotizaciones, habilita esto:
        // const [reqs, cots] = await Promise.all([obtenerRequerimientos(), obtenerCotizaciones()]);
        // setRequerimientos((reqs || []).map(r => ({ value: r.id, label: r.numero || r.asunto, raw: r })));
        // setCotizaciones((cots || []).map(c => ({ value: c.id, label: c.numero || c.proveedorRazonSocial, raw: c })));

        const { numero } = await obtenerSiguienteNumeroOrden();
        setNumero(numero);
      } catch (e) {
        console.error(e);
        setError("Error cargando datos iniciales.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleChange = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const agregarItem = () => {
    setForm(f => ({
      ...f,
      items: [
        ...f.items,
        { codigo: "", descripcion: "", cantidad: 1, um: "UND", pu: 0, dscto: 0, subtotal: 0 },
      ],
    }));
  };

  const actualizarItem = (index, key, value) => {
    setForm(f => {
      const items = [...f.items];
      items[index] = { ...items[index], [key]: value };
      const cantidad = Number(items[index].cantidad || 0);
      const pu = Number(items[index].pu || 0);
      const dscto = Number(items[index].dscto || 0);
      items[index].subtotal = Math.max(0, cantidad * pu - dscto);
      return { ...f, items };
    });
  };

  const eliminarItem = (index) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  };

  const validar = () => {
    if (!form.tipoOrden) return "Selecciona el tipo de orden.";
    if (!numero) return "No se pudo obtener el correlativo.";
    if (!form.proveedorId && form.tipoOrden !== "OI") return "Selecciona un proveedor.";
    if (form.items.length === 0) return "Agrega al menos un ítem.";
    if (form.tipoOrden !== "OI") {
      // reglas de enlace
      if (!form.cotizacionId) return "Debes vincular una cotización.";
      if (!form.requerimientoId) return "Debes vincular un requerimiento.";
    }
    return null;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validar();
    if (v) {
      setError(v);
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        ...form,
        numero, // correlativo único
        estado: "Pendiente",
        creadoPor: usuario?.email || form.creadoPor,
      };
      const id = await guardarOrden(payload);
      await registrarLog("ui_crear_orden", id, usuario?.email || "");
      navigate(`/ver/${id}`);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Error al guardar la orden.");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return <div className="p-4">Cargando...</div>;
  }

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
        {/* Correlativo & Tipo */}
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

        {/* Vínculos (Req/Cot) */}
        {form.tipoOrden !== "OI" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Requerimiento</label>
              {/* Si tienes datos reales, usa <Select options={requerimientos} .../> */}
              <input
                placeholder="ID de Requerimiento (temporal)"
                value={form.requerimientoId || ""}
                onChange={(e) => handleChange("requerimientoId", e.target.value)}
                className="border rounded w-full px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Cotización</label>
              {/* Si tienes datos reales, usa <Select options={cotizaciones} .../> */}
              <input
                placeholder="ID de Cotización (temporal)"
                value={form.cotizacionId || ""}
                onChange={(e) => handleChange("cotizacionId", e.target.value)}
                className="border rounded w-full px-2 py-1"
              />
            </div>
          </div>
        )}

        {/* Proveedor / Condición de Pago / Centro de Costo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Proveedor</label>
            {form.tipoOrden === "OI" ? (
              <input
                readOnly
                placeholder="No aplica para OI"
                className="border rounded w-full px-2 py-1 bg-gray-50"
              />
            ) : (
              <Select
                styles={selectStyles}
                options={proveedores}
                value={proveedores.find(p => p.value === form.proveedorId) || null}
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
              value={condicionesPago.find(p => p.value === form.condicionPagoId) || null}
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
              value={centrosCosto.find(c => c.value === form.centroCostoId) || null}
              onChange={(opt) => handleChange("centroCostoId", opt?.value || null)}
              placeholder="Selecciona centro de costo..."
              isClearable
            />
          </div>
        </div>

        {/* Ítems */}
        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Detalle del Pedido</h2>
            <button type="button" onClick={agregarItem} className="px-3 py-1 border rounded hover:bg-gray-50">
              + Agregar ítem
            </button>
          </div>

          {/* Puedes seguir usando tu componente ItemTable si ya lo tienes */}
          {/* Aquí una tabla simple inline por si no lo usas */}
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
                {form.items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <input className="border rounded px-2 py-1 w-full"
                             value={it.codigo}
                             onChange={(e)=>actualizarItem(i, "codigo", e.target.value)} />
                    </td>
                    <td className="p-2">
                      <input className="border rounded px-2 py-1 w-full"
                             value={it.descripcion}
                             onChange={(e)=>actualizarItem(i, "descripcion", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">
                      <input type="number" min="0" className="border rounded px-2 py-1 w-24 text-right"
                             value={it.cantidad}
                             onChange={(e)=>actualizarItem(i, "cantidad", e.target.value)} />
                    </td>
                    <td className="p-2">
                      <input className="border rounded px-2 py-1 w-20"
                             value={it.um}
                             onChange={(e)=>actualizarItem(i, "um", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">
                      <input type="number" min="0" step="0.01" className="border rounded px-2 py-1 w-28 text-right"
                             value={it.pu}
                             onChange={(e)=>actualizarItem(i, "pu", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">
                      <input type="number" min="0" step="0.01" className="border rounded px-2 py-1 w-28 text-right"
                             value={it.dscto}
                             onChange={(e)=>actualizarItem(i, "dscto", e.target.value)} />
                    </td>
                    <td className="p-2 text-right">{it.subtotal?.toFixed(2)}</td>
                    <td className="p-2 text-right">
                      <button type="button" className="text-red-600 hover:underline" onClick={()=>eliminarItem(i)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {form.items.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-500 py-6">Sin ítems</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* IGV / Resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="block text-sm font-medium">Moneda</label>
              <select
                value={form.moneda}
                onChange={(e) => handleChange("moneda", e.target.value)}
                className="border rounded px-2 py-1 w-full"
              >
                <option value="PEN">PEN (S/.)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">IGV</label>
              <input
                type="number"
                step="0.01"
                value={form.igv}
                onChange={(e) => handleChange("igv", e.target.value)}
                className="border rounded px-2 py-1 w-full"
              />
            </div>
            <div className="text-right md:text-right">
              <div className="text-sm">SubTotal: <strong>{totals.sub.toFixed(2)}</strong></div>
              <div className="text-sm">IGV: <strong>{totals.igvMonto.toFixed(2)}</strong></div>
              <div className="text-base">Total: <strong>{totals.total.toFixed(2)}</strong></div>
            </div>
          </div>
        </div>

        {/* Entrega / Notas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium">Lugar de Entrega/Ejecución</label>
            <input
              value={form.lugarEntrega}
              onChange={(e) => handleChange("lugarEntrega", e.target.value)}
              className="border rounded px-2 py-1 w-full"
              placeholder="Ej. Almacén central / Dirección"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Plazo de Entrega</label>
            <input
              value={form.plazoEntrega}
              onChange={(e) => handleChange("plazoEntrega", e.target.value)}
              className="border rounded px-2 py-1 w-full"
              placeholder="Ej. 7 días hábiles"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Responsable</label>
            <input
              value={form.responsable}
              onChange={(e) => handleChange("responsable", e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
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
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
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
