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
  const axisTick = { fontSize: 11, fill: 'var(--dashboard-text-muted)' };
  const tooltipStyle = {
    backgroundColor: 'var(--dashboard-surface)',
    border: '1px solid var(--dashboard-border)',
    borderRadius: 8,
    color: 'var(--dashboard-text)',
  };
  const tooltipLabelStyle = { color: 'var(--dashboard-text)' };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="brand-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--dashboard-text)]">Conversas e agendamentos no mês</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={normalized}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-border)" />
              <XAxis dataKey="day" tick={axisTick} />
              <YAxis tick={axisTick} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ color: 'var(--dashboard-text-muted)' }} />
              <Line type="monotone" dataKey="conversations" name="Conversas" stroke="#d91e2e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="appointments" name="Agendamentos" stroke="#94a3b8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="brand-panel p-5">
        <h2 className="mb-4 text-sm font-semibold text-[var(--dashboard-text)]">Handoffs e erros</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={normalized}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--dashboard-border)" />
              <XAxis dataKey="day" tick={axisTick} />
              <YAxis tick={axisTick} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
              <Legend wrapperStyle={{ color: 'var(--dashboard-text-muted)' }} />
              <Bar dataKey="handoffs" name="Handoffs" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="dlq" name="Erros na fila" fill="#d91e2e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
