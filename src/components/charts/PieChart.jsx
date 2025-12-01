// ✅ src/components/charts/PieChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  PieChart as RPieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { SERIES_COLORS } from "./chartsTheme";

const MemphisPieChart = ({
  data,
  valueKey = "valor",
  nameKey = "label",
  height = 220,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-xs text-gray-400">
        No hay datos.
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height={height}>
        <RPieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            outerRadius={80}
            paddingAngle={3}
          >
            {data.map((_, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={SERIES_COLORS[idx % SERIES_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            formatter={(value) => (
              <span className="text-xs text-gray-600">{value}</span>
            )}
          />
        </RPieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemphisPieChart;
