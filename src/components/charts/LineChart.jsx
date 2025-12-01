// ✅ src/components/charts/LineChart.jsx
import React from "react";
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { MEMPHIS_COLORS, formatNumber } from "./chartsTheme";

const MemphisLineChart = ({
  data,
  xKey = "label",
  yKey = "total",
  height = 220,
}) => {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height={height}>
        <RLineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickMargin={6} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => formatNumber(v, 0)}
          />
          <Tooltip
            formatter={(value) =>
              formatNumber(value, 2)
            }
          />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={MEMPHIS_COLORS.primary}
            strokeWidth={2}
            dot={false}
          />
        </RLineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MemphisLineChart;
