'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Point {
  day: string;
  conversations: number;
  appointments: number;
  handoffs: number;
  dlq: number;
}

export function TenantMetricCharts({ data }: { data: Point[] }) {
  const normalized = data.length ? data : [{ day: 'sem dados', conversations: 0, appointments: 0, handoffs: 0, dlq: 0 }];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="brand-panel p-5">
        <h2 className="text-sm font-semibold text-[#1f252b] mb-4">Conversas e agendamentos no mês</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalized}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="conversations" name="Conversas" stroke="#d91e2e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="appointments" name="Agendamentos" stroke="#1f252b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="brand-panel p-5">
        <h2 className="text-sm font-semibold text-[#1f252b] mb-4">Handoffs e erros</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={normalized}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="handoffs" name="Handoffs" fill="#6b7280" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dlq" name="Erros na fila" fill="#d91e2e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
