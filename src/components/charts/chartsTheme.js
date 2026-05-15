// ✅ src/components/charts/chartsTheme.js

// Paleta corporativa Memphis
export const MEMPHIS_COLORS = {
  primary: "#000000",   // negro Memphis
  secondary: "#000000", // negro (el amarillo #f0c000 no tiene contraste como texto sobre blanco)
  success: "#2EB67D",
  danger: "#E03E3E",
  neutral: "#6B7280",
  neutralLight: "#E5E7EB",
};

export const SERIES_COLORS = [
  "#000000",   // negro (serie principal)
  "#f0c000",   // amarillo Memphis (como relleno de gráficos sí tiene contraste)
  MEMPHIS_COLORS.success,
  MEMPHIS_COLORS.danger,
  MEMPHIS_COLORS.neutral,
  "#6366F1",
  "#F97316",
  "#14B8A6",
];

export const formatMoney = (value, currency = "PEN") =>
  Number(value || 0).toLocaleString("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const formatNumber = (value, digits = 0) =>
  Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
