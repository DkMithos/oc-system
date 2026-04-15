import React, { useState, useRef, useEffect } from "react";
import { buscarEnCatalogo } from "../utils/catalogoItems";

/**
 * Input con autocompletado del catálogo de ítems estandarizados.
 *
 * Props:
 * - value: string (texto del input)
 * - onChange: (text) => void
 * - onSelect: ({ codigo, nombre, unidad }) => void
 * - placeholder: string
 * - className: string
 */
const CatalogoItemSearch = ({
  value,
  onChange,
  onSelect,
  placeholder = "Buscar en catálogo...",
  className = "",
}) => {
  const [resultados, setResultados] = useState([]);
  const [mostrar, setMostrar] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const res = buscarEnCatalogo(value);
    setResultados(res);
    setMostrar(res.length > 0 && value.length >= 2);
  }, [value]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setMostrar(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`border p-2 rounded w-full text-sm ${className}`}
        onFocus={() => resultados.length > 0 && setMostrar(true)}
      />
      {mostrar && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full max-w-md bg-white border rounded shadow-lg max-h-56 overflow-y-auto">
          {resultados.map((item) => (
            <button
              key={item.codigo}
              type="button"
              className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0"
              onClick={() => {
                onSelect(item);
                setMostrar(false);
              }}
            >
              <span className="font-mono text-xs text-blue-700 mr-2">{item.codigo}</span>
              <span className="text-sm text-gray-800">{item.nombre}</span>
              <span className="text-xs text-gray-400 ml-2">({item.unidad})</span>
              <span className="text-xs text-gray-400 float-right">{item.categoria}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CatalogoItemSearch;
