// ✅ src/components/charts/BarChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { MEMPHIS_COLORS, formatNumber } from "./chartsTheme";

const MemphisBarChart = ({
  data,
  xKey = "nombre",
  yKey = "total",
  layout = "vertical", // "vertical" (barras horizontales) | "horizontal"
  height = 220,
}) => {
  const isVertical = layout === "vertical";

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height={height}>
        <RBarChart
          data={data}
          layout={layout}
          margin={
            isVertical
              ? { top: 5, right: 20, left: 80, bottom: 5 }
              : { top: 5, right: 20, left: 10, bottom: 20 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          {isVertical ? (
            <>
              <XAxis
                type="number"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => formatNumber(v, 0)}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fontSize: 10 }}
                width={120}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 10 }}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v) => formatNumber(v, 0)}
              />
            </>
          )}
          <Tooltip
            formatter={(value) =>
              formatNumber(value, 2)
            }
          />
          <Bar
            dataKey={yKey}
            radius={[4, 4, 4, 4]}
            fill={MEMPHIS_COLORS.primary}
          />
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemphisBarChart;
