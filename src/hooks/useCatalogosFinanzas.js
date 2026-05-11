// src/hooks/useCatalogosFinanzas.js
// Hook reutilizable para cargar catálogos financieros + proveedores + centros de costo.
// Extraído de FlujosFinancieros.jsx (Fase 2 refactor).

import { useEffect, useMemo, useState } from "react";
import {
  obtenerCatalogosFinanzas,
  obtenerProveedoresLigero,
  obtenerCentrosCostoLigero,
} from "../firebase/finanzasHelpers";

const INITIAL_CATALOGOS = {
  igv: [],
  categorias: [],
  subcategorias: [],
  formasPago: [],
  estados: [],
  tiposDocumento: [],
  proyectos: [],
};

export default function useCatalogosFinanzas() {
  const [catalogos, setCatalogos] = useState(INITIAL_CATALOGOS);
  const [proveedores, setProveedores] = useState([]);
  const [centrosCosto, setCentrosCosto] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    const cargar = async () => {
      setCargandoCatalogos(true);
      try {
        const [data, provs, ccs] = await Promise.all([
          obtenerCatalogosFinanzas(),
          obtenerProveedoresLigero(),
          obtenerCentrosCostoLigero(),
        ]);
        if (!activo) return;
        setCatalogos((prev) => ({ ...prev, ...data }));
        setProveedores(provs || []);
        setCentrosCosto(ccs || []);
      } catch (e) {
        console.error("Error cargando catálogos financieros:", e);
        if (activo) setError("Error cargando catálogos financieros.");
      } finally {
        if (activo) setCargandoCatalogos(false);
      }
    };
    cargar();
    return () => { activo = false; };
  }, []);

  const proveedorOptions = useMemo(
    () => proveedores.map((p) => ({
      id: p.id || p.ruc,
      label: p.razonSocial,
      subLabel: p.ruc,
      raw: p,
    })),
    [proveedores]
  );

  const centroCostoOptions = useMemo(
    () => centrosCosto.map((c) => ({
      id: c.id,
      label: c.nombre,
      subLabel: c.codigo || "",
      raw: c,
    })),
    [centrosCosto]
  );

  return {
    catalogos,
    proveedores,
    centrosCosto,
    proveedorOptions,
    centroCostoOptions,
    cargandoCatalogos,
    error,
  };
}
