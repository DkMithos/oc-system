// ✅ src/pages/MiFirma.jsx
import React, { useEffect, useRef, useState } from "react";
import { useUsuario } from "../context/UsuarioContext";
import {
  obtenerFirmaGuardada,
  guardarFirmaUsuario,
  guardarFirmaDesdeArchivo,
} from "../firebase/firmasHelpers";

const MiFirma = () => {
  const { usuario } = useUsuario();
  const email = usuario?.email || "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actual, setActual] = useState(""); // dataURL
  const [tab, setTab] = useState("subir"); // subir | dibujar
  const [stroke, setStroke] = useState(2);

  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    (async () => {
      if (!email) return;
      const f = await obtenerFirmaGuardada(email);
      setActual(f || "");
      setLoading(false);
    })();
  }, [email]);

  // Canvas
  const ctx = () => {
    const c = canvasRef.current;
    if (!c) return null;
    const context = c.getContext("2d");
    context.lineWidth = stroke;
    context.lineCap = "round";
    context.strokeStyle = "#111";
    return context;
  };
  const start = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    drawing.current = true;
    const c = ctx();
    c.beginPath();
    c.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    const c = ctx();
    c.lineTo(x, y);
    c.stroke();
  };
  const end = () => (drawing.current = false);
  const limpiar = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d").clearRect(0, 0, c.width, c.height);
  };
  const guardarCanvas = async () => {
    if (!email) return;
    setSaving(true);
    try {
      const c = canvasRef.current;
      const dataUrl = c.toDataURL("image/png");
      await guardarFirmaUsuario(email, dataUrl);
      setActual(dataUrl);
      alert("Firma guardada ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la firma.");
    }
    setSaving(false);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      alert("Sube un PNG o JPG.");
      return;
    }
    setSaving(true);
    try {
      const url = await guardarFirmaDesdeArchivo(email, file);
      setActual(url);
      alert("Firma actualizada ✅");
    } catch (err) {
      console.error(err);
      alert("No se pudo subir la firma.");
    }
    setSaving(false);
  };

  if (!email) return <div className="p-6">Debes iniciar sesión.</div>;
  if (loading) return <div className="p-6">Cargando…</div>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-[#004990] mb-2">Mi Firma</h2>
      <p className="text-gray-600 mb-4">
        Registra tu firma para aprobar/rechazar órdenes. Puedes subir una imagen o dibujarla.
      </p>

      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">Firma actual:</p>
        <div className="border rounded p-3 bg-white min-h-[120px] flex items-center justify-center">
          {actual ? (
            <img src={actual} alt="Firma" className="max-h-24 object-contain" />
          ) : (
            <span className="text-gray-400">No tienes una firma registrada.</span>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("subir")}
          className={`px-3 py-1 rounded border ${tab === "subir" ? "bg-[#004990] text-white border-[#004990]" : "bg-white"}`}
        >
          Subir imagen
        </button>
        <button
          onClick={() => setTab("dibujar")}
          className={`px-3 py-1 rounded border ${tab === "dibujar" ? "bg-[#004990] text-white border-[#004990]" : "bg-white"}`}
        >
          Dibujar
        </button>
      </div>

      {tab === "subir" && (
        <div className="bg-white p-4 rounded border max-w-md">
          <input type="file" accept="image/png,image/jpeg" onChange={onFile} />
          <p className="text-xs text-gray-500 mt-2">
            Recomendación: PNG con fondo transparente, ancho ≥ 600px.
          </p>
        </div>
      )}

      {tab === "dibujar" && (
        <div className="bg-white p-4 rounded border inline-block">
          <div className="flex items-center gap-3 mb-2">
            <label className="text-sm">Grosor:</label>
            <input
              type="range"
              min="1"
              max="6"
              value={stroke}
              onChange={(e) => setStroke(Number(e.target.value))}
            />
            <span className="text-sm">{stroke}px</span>
          </div>

          <div className="border rounded bg-white">
            <canvas
              ref={canvasRef}
              width={700}
              height={180}
              className="touch-none"
              style={{ background: "transparent", display: "block" }}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
            />
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={limpiar} className="px-3 py-1 rounded border">
              Limpiar
            </button>
            <button
              disabled={saving}
              onClick={guardarCanvas}
              className="px-3 py-1 rounded bg-[#004990] text-white disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar firma"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MiFirma;
