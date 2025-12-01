// ✅ src/components/charts/DonutChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { SERIES_COLORS } from "./chartsTheme";

const MemphisDonutChart = ({
  data,
  valueKey = "cantidad",
  nameKey = "estado",
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
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            outerRadius={70}
            innerRadius={35}
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
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemphisDonutChart;
