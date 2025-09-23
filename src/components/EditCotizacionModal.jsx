// ✅ src/components/EditCotizacionModal.jsx
import React, { useEffect, useState } from "react";
import { actualizarCotizacion } from "../firebase/cotizacionesHelpers";
import { storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { formatearMoneda } from "../utils/formatearMoneda";

const Backdrop = ({ children, onClose, title }) => (
  <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-2">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200">Cerrar</button>
      </div>
      {children}
    </div>
  </div>
);

const EditCotizacionModal = ({ cotizacion, open, onClose, onSaved }) => {
  const [detalle, setDetalle] = useState("");
  const [items, setItems] = useState([]);
  const [file, setFile] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!cotizacion) return;
    setDetalle(cotizacion.detalle || "");
    setItems(
      (cotizacion.items || []).map((it) => ({
        nombre: it.nombre || "",
        cantidad: Number(it.cantidad || 0),
        precioUnitario: Number(it.precioUnitario || 0),
      }))
    );
    setFile(null);
  }, [cotizacion]);

  if (!open || !cotizacion) return null;

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { nombre: "", cantidad: 1, precioUnitario: 0 },
    ]);

  const updateItem = (i, k, v) =>
    setItems((prev) => {
      const arr = [...prev];
      arr[i] = { ...arr[i], [k]: k === "nombre" ? v : Number(v || 0) };
      return arr;
    });

  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const total = items.reduce(
    (acc, it) => acc + Number(it.cantidad || 0) * Number(it.precioUnitario || 0),
    0
  );

  const save = async () => {
    // Validación mínima
    if (!items.length || items.some((i) => !i.nombre || i.precioUnitario <= 0)) {
      alert("Completa los ítems (nombre y precio > 0).");
      return;
    }

    setGuardando(true);
    try {
      const update = {
        detalle: (detalle || "").trim(),
        items: items.map((i) => ({
          nombre: i.nombre,
          cantidad: Number(i.cantidad || 0),
          precioUnitario: Number(i.precioUnitario || 0),
        })),
        actualizadoEn: new Date().toISOString(),
      };

      // Si subieron nuevo archivo, reemplazar
      if (file) {
        const ext = (file.name.split(".").pop() || "").toLowerCase();
        const safe = (cotizacion.codigo || cotizacion.id).replace(/[^\w\-]+/g, "_") + "." + ext;
        const storageRef = ref(storage, `cotizaciones/${cotizacion.id}/${safe}`);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        update.archivoUrl = url;
      }

      await actualizarCotizacion(cotizacion.id, update);
      onSaved?.();
      onClose?.();
      alert("Cotización actualizada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar la cotización.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Backdrop onClose={onClose} title={`Editar Cotización ${cotizacion.codigo || ""}`}>
      <div className="p-4 space-y-3">
        <div>
          <label className="block text-sm font-medium">Detalle</label>
          <input
            className="border rounded px-2 py-1 w-full"
            value={detalle}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Detalle u observación de la cotización"
          />
        </div>

        <div className="border rounded p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-semibold">Ítems</h4>
            <button onClick={addItem} className="px-3 py-1 border rounded hover:bg-gray-50">
              + Agregar ítem
            </button>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-2">Ítem</th>
                  <th className="text-right p-2">Cant.</th>
                  <th className="text-right p-2">P. Unit</th>
                  <th className="text-right p-2">Subtotal</th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const subtotal = Number(it.cantidad || 0) * Number(it.precioUnitario || 0);
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">
                        <input
                          className="border rounded px-2 py-1 w-full"
                          value={it.nombre}
                          onChange={(e) => updateItem(i, "nombre", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          className="border rounded px-2 py-1 w-24 text-right"
                          value={it.cantidad}
                          onChange={(e) => updateItem(i, "cantidad", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="border rounded px-2 py-1 w-28 text-right"
                          value={it.precioUnitario}
                          onChange={(e) => updateItem(i, "precioUnitario", e.target.value)}
                        />
                      </td>
                      <td className="p-2 text-right">{formatearMoneda(subtotal)}</td>
                      <td className="p-2 text-right">
                        <button className="text-red-600 hover:underline" onClick={() => removeItem(i)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-6">Sin ítems</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-right mt-2">
            <span className="text-sm">
              <b>Total:</b> {formatearMoneda(total)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Reemplazar archivo (opcional)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border rounded px-2 py-1 w-full"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button className="px-3 py-1 rounded border" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          <button
            className="px-3 py-1 rounded bg-[#004990] text-white disabled:opacity-60"
            onClick={save}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </Backdrop>
  );
};

export default EditCotizacionModal;
