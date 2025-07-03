import React from "react";
import { formatearMoneda } from "../utils/formatearMoneda";

const ItemTable = ({ items, setItems, moneda }) => {
  const handleChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] =
      field === "nombre" ? value : parseFloat(value) || 0;
    setItems(updated);
  };

  const addItem = () => {
    const newItem = {
      id: Date.now(), // aseguramos ID único
      nombre: "",
      cantidad: 0,
      precioUnitario: 0,
      descuento: 0,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const calcularNeto = (item) =>
    (item.precioUnitario - item.descuento) * item.cantidad;

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
              <th className="p-2 border">Nombre</th>
              <th className="p-2 border text-center">Cantidad</th>
              <th className="p-2 border text-center">P. Unitario</th>
              <th className="p-2 border text-center">Descuento</th>
              <th className="p-2 border text-center">P. Neto</th>
              <th className="p-2 border text-center">Total</th>
              <th className="p-2 border text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const netoUnitario = item.precioUnitario - item.descuento;
              const totalItem = calcularNeto(item);

              return (
                <tr key={item.id} className="border-t text-center">
                  <td className="p-2 border">{i + 1}</td>
                  <td className="p-2 border">
                    <input
                      type="text"
                      value={item.nombre}
                      onChange={(e) =>
                        handleChange(i, "nombre", e.target.value)
                      }
                      className="w-full border rounded px-2 py-1"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) =>
                        handleChange(i, "cantidad", e.target.value)
                      }
                      className="w-20 border rounded px-2 text-right"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) =>
                        handleChange(i, "precioUnitario", e.target.value)
                      }
                      className="w-24 border rounded px-2 text-right"
                    />
                  </td>
                  <td className="p-2 border">
                    <input
                      type="number"
                      value={item.descuento}
                      onChange={(e) =>
                        handleChange(i, "descuento", e.target.value)
                      }
                      className="w-24 border rounded px-2 text-right"
                    />
                  </td>
                  <td className="p-2 border text-right">
                    {formatearMoneda(netoUnitario, moneda)}
                  </td>
                  <td className="p-2 border text-right">
                    {formatearMoneda(totalItem, moneda)}
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

