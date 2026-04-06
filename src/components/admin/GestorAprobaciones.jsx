// src/components/admin/GestorAprobaciones.jsx
// Panel para configurar el flujo de aprobaciones desde Admin.
// Lee/escribe en Firestore: configuracion/aprobaciones

import { useState, useEffect } from "react";
import { Settings2, Save, RefreshCw, Info, CheckCircle2 } from "lucide-react";
import {
  obtenerConfigAprobaciones,
  guardarConfigAprobaciones,
  UMBRALES_DEFAULT,
} from "../../utils/aprobaciones";

const GestorAprobaciones = () => {
  const [config, setConfig]       = useState(null);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado]   = useState(false);
  const [error, setError]         = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const data = await obtenerConfigAprobaciones();
      setConfig({
        soloOperaciones: data.soloOperaciones ?? UMBRALES_DEFAULT.soloOperaciones,
        gerenciaGeneral: data.gerenciaGeneral ?? UMBRALES_DEFAULT.gerenciaGeneral,
        tipoCambioDef:   data.tipoCambioDef   ?? UMBRALES_DEFAULT.tipoCambioDef,
        monedaBase:      data.monedaBase      ?? UMBRALES_DEFAULT.monedaBase,
      });
    } catch {
      setError("No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const handleChange = (campo, valor) => {
    setConfig((prev) => ({ ...prev, [campo]: valor }));
    setGuardado(false);
    setError("");
  };

  const guardar = async () => {
    if (!config) return;
    const umbral = Number(config.soloOperaciones);
    const tc     = Number(config.tipoCambioDef);
    if (isNaN(umbral) || umbral < 0) { setError("El umbral debe ser un número positivo."); return; }
    if (isNaN(tc)     || tc < 1)     { setError("El tipo de cambio debe ser mayor a 1."); return; }

    setGuardando(true);
    setError("");
    try {
      await guardarConfigAprobaciones({
        soloOperaciones: umbral,
        gerenciaGeneral: umbral,   // mismo umbral — >umbral requiere GG
        tipoCambioDef:   tc,
        monedaBase:      config.monedaBase,
      });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch {
      setError("Error al guardar. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div className="erp-card p-5 mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-10 bg-gray-100 rounded mb-3" />
        <div className="h-10 bg-gray-100 rounded" />
      </div>
    );
  }

  const umbral = Number(config?.soloOperaciones ?? 5000);

  return (
    <div className="erp-card p-5 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-[--brand-700]" />
          <h3 className="section-title mb-0">Flujo de Aprobaciones</h3>
        </div>
        <button
          onClick={cargar}
          className="btn btn-secondary btn-sm flex items-center gap-1"
          title="Recargar desde Firestore"
        >
          <RefreshCw size={12} />
          Recargar
        </button>
      </div>

      {/* Info banner */}
      <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5 text-xs text-blue-800">
        <Info size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-0.5">Regla activa:</p>
          <p>
            OCs <span className="font-semibold">≤ S/{umbral.toLocaleString("es-PE")}</span>:
            requieren aprobación de <span className="font-semibold">Operaciones</span> únicamente.
          </p>
          <p className="mt-0.5">
            OCs <span className="font-semibold">&gt; S/{umbral.toLocaleString("es-PE")}</span>:
            requieren Operaciones <span className="font-semibold">+</span> Gerencia General.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {/* Umbral */}
        <div>
          <label className="erp-label">
            Umbral para Gerencia General (S/)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={config?.soloOperaciones ?? ""}
            onChange={(e) => handleChange("soloOperaciones", e.target.value)}
            className="erp-input"
            placeholder="5000"
          />
          <p className="text-[11px] text-[--text-muted] mt-1">
            OCs por encima de este monto requerirán Gerencia General.
          </p>
        </div>

        {/* Tipo de cambio */}
        <div>
          <label className="erp-label">Tipo de Cambio USD → SOL</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={config?.tipoCambioDef ?? ""}
            onChange={(e) => handleChange("tipoCambioDef", e.target.value)}
            className="erp-input"
            placeholder="3.80"
          />
          <p className="text-[11px] text-[--text-muted] mt-1">
            Utilizado para convertir OCs en USD al comparar con el umbral.
          </p>
        </div>

        {/* Moneda base (informativo) */}
        <div>
          <label className="erp-label">Moneda Base</label>
          <select
            value={config?.monedaBase ?? "Soles"}
            onChange={(e) => handleChange("monedaBase", e.target.value)}
            className="erp-select"
          >
            <option value="Soles">Soles (PEN)</option>
            <option value="Dólares">Dólares (USD)</option>
          </select>
          <p className="text-[11px] text-[--text-muted] mt-1">
            Moneda en que se expresan los umbrales.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={guardar}
          disabled={guardando}
          className="btn btn-primary flex items-center gap-1.5 disabled:opacity-60"
        >
          {guardando
            ? <RefreshCw size={13} className="animate-spin" />
            : <Save size={13} />
          }
          {guardando ? "Guardando…" : "Guardar configuración"}
        </button>

        {guardado && (
          <span className="flex items-center gap-1.5 text-xs text-green-700 font-semibold">
            <CheckCircle2 size={14} />
            Configuración guardada
          </span>
        )}
      </div>
    </div>
  );
};

export default GestorAprobaciones;
