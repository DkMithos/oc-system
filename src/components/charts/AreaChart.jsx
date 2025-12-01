// ✅ src/components/charts/AreaChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  AreaChart as RAreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { MEMPHIS_COLORS, formatNumber } from "./chartsTheme";

const MemphisAreaChart = ({
  data,
  xKey = "label",
  yKey = "total",
  height = 220,
  yTicksDigits = 0,
  descripcion,
}) => {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height={height}>
        <RAreaChart data={data}>
          <defs>
            <linearGradient id="memphisAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={MEMPHIS_COLORS.primary}
                stopOpacity={0.6}
              />
              <stop
                offset="95%"
                stopColor={MEMPHIS_COLORS.primary}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 10 }}
            tickMargin={6}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => formatNumber(v, yTicksDigits)}
          />
          <Tooltip
            formatter={(value) =>
              formatNumber(value, 2)
            }
            labelFormatter={(l) => `${descripcion || ""} ${l}`.trim()}
          />
          <Area
            type="monotone"
            dataKey={yKey}
            stroke={MEMPHIS_COLORS.primary}
            strokeWidth={2}
            fill="url(#memphisAreaFill)"
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemphisAreaChart;
