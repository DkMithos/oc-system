// ✅ src/components/charts/KPI.jsx
import React from "react";
import { MEMPHIS_COLORS, formatMoney, formatNumber } from "./chartsTheme";

const KPI = ({
  titulo,
  valor = 0,
  tipo = "moneda", // "moneda" | "numero" | "horas"
  subtitulo,
  variant = "primary", // "primary" | "secondary" | "success" | "danger" | "neutral"
  currency = "PEN", // "PEN" | "USD" | etc
}) => {
  let display = "";

  if (tipo === "moneda") {
    display = formatMoney(valor, currency);
  } else if (tipo === "horas") {
    display = `${formatNumber(valor, 1)} h`;
  } else {
    display = formatNumber(valor, 0);
  }

  const variantColor =
    {
      primary: MEMPHIS_COLORS.primary,
      secondary: MEMPHIS_COLORS.secondary,
      success: MEMPHIS_COLORS.success,
      danger: MEMPHIS_COLORS.danger,
      neutral: MEMPHIS_COLORS.neutral,
    }[variant] || MEMPHIS_COLORS.primary;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">
        {titulo}
      </span>
      <span className="text-xl font-semibold" style={{ color: variantColor }}>
        {display}
      </span>
      {subtitulo && (
        <span className="text-[11px] text-gray-400">{subtitulo}</span>
      )}
    </div>
  );
};

export default KPI;
