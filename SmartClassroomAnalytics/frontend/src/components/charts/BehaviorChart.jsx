import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = ['#6366f1', '#f59e0b', '#ec4899', '#10b981', '#8b5cf6'];

export default function BehaviorChart({ data, height = 260 }) {
  if (!data || !data.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-xs text-slate-400 bg-slate-50/50 rounded-lg border border-dashed border-slate-200"
      >
        No behavior events recorded
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              borderRadius: '8px',
              border: 'none',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              color: '#f8fafc',
              fontSize: '12px',
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="circle"
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
          />
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
            nameKey="name"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
