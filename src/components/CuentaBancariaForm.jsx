import React from "react";

const CuentaBancariaForm = ({
  cuenta,
  setCuenta,
  cuentas,
  setCuentas,
}) => {
  const agregarCuenta = () => {
    if (!cuenta.nombre || !cuenta.cuenta || !cuenta.moneda) {
      alert("Completa los campos obligatorios de la cuenta");
      return;
    }

    setCuentas([...cuentas, cuenta]);
    setCuenta({ nombre: "", cuenta: "", cci: "", moneda: "" });
  };

  const eliminarCuenta = (index) => {
    const actualizadas = cuentas.filter((_, i) => i !== index);
    setCuentas(actualizadas);
  };

  return (
    <div className="col-span-2">
      <h3 className="font-semibold mb-2">Cuentas Bancarias</h3>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
        <input
          type="text"
          placeholder="Banco"
          value={cuenta.nombre}
          onChange={(e) => setCuenta({ ...cuenta, nombre: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="Número de Cuenta"
          value={cuenta.cuenta}
          onChange={(e) => setCuenta({ ...cuenta, cuenta: e.target.value })}
          className="border p-2 rounded"
        />
        <input
          type="text"
          placeholder="CCI"
          value={cuenta.cci}
          onChange={(e) => setCuenta({ ...cuenta, cci: e.target.value })}
          className="border p-2 rounded"
        />
        <select
          value={cuenta.moneda}
          onChange={(e) => setCuenta({ ...cuenta, moneda: e.target.value })}
          className="border p-2 rounded"
        >
          <option value="">Moneda</option>
          <option value="Soles">Soles</option>
          <option value="Dólares">Dólares</option>
        </select>
      </div>

      <button
        type="button"
        onClick={agregarCuenta}
        className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
      >
        Agregar Cuenta
      </button>

      {cuentas.length > 0 && (
        <table className="w-full text-sm border mt-4">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-1">Banco</th>
              <th className="p-1">Cuenta</th>
              <th className="p-1">CCI</th>
              <th className="p-1">Moneda</th>
              <th className="p-1">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cuentas.map((b, i) => (
              <tr key={i} className="border-t">
                <td className="p-1">{b.nombre}</td>
                <td className="p-1">{b.cuenta}</td>
                <td className="p-1">{b.cci}</td>
                <td className="p-1">{b.moneda}</td>
                <td className="p-1">
                  <button
                    className="text-red-600 text-sm underline"
                    onClick={() => eliminarCuenta(i)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default CuentaBancariaForm;
