import React from "react";
import { formatearMoneda } from "../utils/formatearMoneda";

/**
 * ItemTable
 * - Clarifica columnas: Código, Descripción, Cant., U.M., P.Unit, Dscto, Neto, Total
 * - Cálculo por fila consistente con CrearOC.jsx:
 *     totalItem = (cantidad * precioUnitario) - descuento
 *     netoUnitario = precioUnitario - descuento
 * - 'moneda' acepta "Soles" | "Dólares"
 */
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const ItemTable = ({ items, setItems, moneda = "Soles" }) => {
  const handleChange = (index, field, value) => {
    const updated = [...items];
    if (["cantidad", "precioUnitario", "descuento"].includes(field)) {
      updated[index][field] = num(value);
    } else {
      updated[index][field] = value;
    }
    setItems(updated);
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(),
      codigo: "",
      nombre: "",
      unidad: "UND",
      cantidad: 1,
      precioUnitario: 0,
      descuento: 0, // monto
    };
    setItems([...(items || []), newItem]);
  };

  const removeItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Totales por fila (idéntico criterio a CrearOC.jsx)
  const netoUnitario = (it) => num(it.precioUnitario) - num(it.descuento);
  const totalItem = (it) => netoUnitario(it) * num(it.cantidad);

  return (
    <div className="bg-white p-6 rounded shadow mb-6">
      <h3 className="text-xl font-bold text-[#003865] mb-4 text-center">
        Ítems de la Orden
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-[#F5F5F5] text-left">
              <th className="p-2 border">#</th>
              <th className="p-2 border">Código</th>
              <th className="p-2 border">Descripción</th>
              <th className="p-2 border text-center">Cant.</th>
              <th className="p-2 border text-center">U.M.</th>
              <th className="p-2 border text-center">P. Unit.</th>
              <th className="p-2 border text-center">Dscto (monto)</th>
              <th className="p-2 border text-center">P. Neto</th>
              <th className="p-2 border text-center">Total</th>
              <th className="p-2 border text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {(items || []).map((item, i) => {
              const neto = netoUnitario(item);
              const total = totalItem(item);
              return (
                <tr key={item.id ?? i} className="border-t text-center">
                  <td className="p-2 border">{i + 1}</td>

                  <td className="p-2 border">
                    <input
                      type="text"
                      value={item.codigo || ""}
                      onChange={(e) => handleChange(i, "codigo", e.target.value)}
                      className="w-28 border rounded px-2 py-1"
                      placeholder="Cód."
                    />
                  </td>

                  <td className="p-2 border">
                    <input
                      type="text"
                      value={item.nombre || ""}
                      onChange={(e) => handleChange(i, "nombre", e.target.value)}
                      className="w-full border rounded px-2 py-1"
                      placeholder="Descripción del ítem"
                    />
                  </td>

                  <td className="p-2 border">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={item.cantidad ?? 0}
                      onChange={(e) => handleChange(i, "cantidad", e.target.value)}
                      className="w-20 border rounded px-2 text-right"
                    />
                  </td>

                  <td className="p-2 border">
                    <input
                      type="text"
                      value={item.unidad || "UND"}
                      onChange={(e) => handleChange(i, "unidad", e.target.value)}
                      className="w-20 border rounded px-2 text-center"
                      placeholder="UND"
                    />
                  </td>

                  <td className="p-2 border">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.precioUnitario ?? 0}
                      onChange={(e) =>
                        handleChange(i, "precioUnitario", e.target.value)
                      }
                      className="w-28 border rounded px-2 text-right"
                    />
                  </td>

                  <td className="p-2 border">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.descuento ?? 0}
                      onChange={(e) => handleChange(i, "descuento", e.target.value)}
                      className="w-28 border rounded px-2 text-right"
                      placeholder="0.00"
                    />
                  </td>

                  <td className="p-2 border text-right">
                    {formatearMoneda(neto, moneda)}
                  </td>

                  <td className="p-2 border text-right">
                    {formatearMoneda(total, moneda)}
                  </td>

                  <td className="p-2 border">
                    <button
                      onClick={() => removeItem(i)}
                      className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              );
            })}
            {(items || []).length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-gray-500 py-6">
                  Sin ítems. Agrega al menos uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-right">
        <button
          onClick={addItem}
          className="bg-[#003865] text-white px-4 py-2 rounded hover:bg-[#002b4c]"
        >
          + Agregar ítem
        </button>
      </div>
    </div>
  );
};

export default ItemTable;
