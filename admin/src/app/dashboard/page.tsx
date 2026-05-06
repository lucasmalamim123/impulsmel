import Link from 'next/link';
import { ImpulsmelMark } from '../../components/brand/ImpulsmelMark';
import { api } from '../../lib/api';

export const dynamic = 'force-dynamic';

interface DashboardData {
  range: { from: string; to: string };
  summary: {
    totalTenants: number;
    webInstancesRunning: number;
    webInstancesConnected: number;
    webInstancesDisconnected: number;
    totalSent: number;
    totalReceived: number;
    monthSent: number;
    monthReceived: number;
    tenantsWithActiveError: number;
    integrationsWithError: number;
    dlqPending: number;
  };
  messageTypes: Record<string, { sent: number; received: number }>;
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    active: boolean;
    instanceStatus: string;
    lastConnectedAt: string | null;
    activeError: boolean;
    errorIntegration: string | null;
    lastError: string | null;
    lastActivityAt: string | null;
    periodSent: number;
    periodReceived: number;
    dlqPending: number;
    lastRagSyncAt: string | null;
  }>;
}

interface AlertRow {
  id: string;
  tenant_id: string;
  integration: string;
  last_error: string | null;
  last_error_at: string | null;
  resolved_at: string | null;
  auto_retry: boolean;
  tenants?: { name: string; slug: string };
}

const PERIODS = [
  ['today', 'Hoje'],
  ['yesterday', 'Ontem'],
  ['this_month', 'Este mês'],
  ['last_month', 'Mês passado'],
];

const STATUSES = [
  ['all', 'Todos'],
  ['connected', 'Conectadas'],
  ['disconnected', 'Desconectadas'],
  ['with_error', 'Com erro'],
];

function fmtDate(value: string | null) {
  if (!value) return 'Sem registro';
  return new Date(value).toLocaleString('pt-BR');
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg border border-white/10 p-4">
      <p className="text-[11px] uppercase font-bold text-[#6b7280]">{label}</p>
      <p className="font-display text-2xl font-bold text-[#1f252b] mt-1">{value}</p>
    </div>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { period?: string; instanceStatus?: string; from?: string; to?: string };
}) {
  const params = new URLSearchParams();
  params.set('period', searchParams.period ?? 'today');
  params.set('instanceStatus', searchParams.instanceStatus ?? 'all');
  if (searchParams.from) params.set('from', searchParams.from);
  if (searchParams.to) params.set('to', searchParams.to);

  const [data, alertsResult] = await Promise.all([
    api.get<DashboardData>(`/api/admin/global-dashboard?${params.toString()}`).catch(() => ({
      range: { from: '', to: '' },
      summary: {
        totalTenants: 0, webInstancesRunning: 0, webInstancesConnected: 0, webInstancesDisconnected: 0,
        totalSent: 0, totalReceived: 0, monthSent: 0, monthReceived: 0, tenantsWithActiveError: 0,
        integrationsWithError: 0, dlqPending: 0,
      },
      messageTypes: {},
      tenants: [],
    })),
    api.get<{ alerts: AlertRow[] }>('/api/admin/global-alerts').catch(() => ({ alerts: [] })),
  ]);

  return (
    <div className="min-h-screen bg-[#1f252b] flex flex-col">
      <header className="px-8 py-5 border-b border-white/10 flex items-center justify-between">
        <ImpulsmelMark inverted />
        <Link href="/admin/tenants/novo" className="brand-button">+ Novo cliente</Link>
      </header>

      <main className="flex-1 px-8 py-8 space-y-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase text-[#d91e2e] mb-1">Operação global</p>
            <h1 className="font-display text-2xl font-bold text-white">Visão geral dos clientes</h1>
            <p className="text-xs text-white/45 mt-1">Período: {fmtDate(data.range.from)} até {fmtDate(data.range.to)}</p>
          </div>

          <form className="flex flex-wrap gap-2 items-end">
            <label className="text-xs text-white/55">
              Período
              <select name="period" defaultValue={searchParams.period ?? 'today'} className="block mt-1 rounded-lg px-3 py-2 text-sm text-[#1f252b]">
                {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs text-white/55">
              Instância web
              <select name="instanceStatus" defaultValue={searchParams.instanceStatus ?? 'all'} className="block mt-1 rounded-lg px-3 py-2 text-sm text-[#1f252b]">
                {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <button className="brand-button h-10">Filtrar</button>
          </form>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Total de clientes" value={data.summary.totalTenants} />
          <Stat label="Instâncias web conectadas" value={data.summary.webInstancesConnected} />
          <Stat label="Instâncias web desconectadas" value={data.summary.webInstancesDisconnected} />
          <Stat label="Mensagens enviadas" value={data.summary.totalSent} />
          <Stat label="Mensagens recebidas" value={data.summary.totalReceived} />
          <Stat label="Enviadas no mês" value={data.summary.monthSent} />
          <Stat label="Recebidas no mês" value={data.summary.monthReceived} />
          <Stat label="Clientes com erro" value={data.summary.tenantsWithActiveError} />
          <Stat label="Integrações com erro" value={data.summary.integrationsWithError} />
          <Stat label="DLQ pendente" value={data.summary.dlqPending} />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="bg-white rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="font-semibold text-[#1f252b]">Clientes</h2>
              <Link href="/admin/tenants" className="text-xs font-semibold text-[#d91e2e] hover:underline">Gerenciar</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#f3f4f6] text-xs text-[#6b7280]">
                  <tr>
                    <th className="text-left px-4 py-3">Cliente</th>
                    <th className="text-left px-4 py-3">Plano</th>
                    <th className="text-left px-4 py-3">WhatsApp</th>
                    <th className="text-left px-4 py-3">Erro ativo</th>
                    <th className="text-left px-4 py-3">Volume</th>
                    <th className="text-left px-4 py-3">Última atividade</th>
                    <th className="text-left px-4 py-3">Última conexão</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.tenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-[#f9fafb]">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1f252b]">{tenant.name}</p>
                        <p className="text-xs text-[#6b7280]">{tenant.slug}</p>
                      </td>
                      <td className="px-4 py-3 text-xs uppercase font-bold">{tenant.plan ?? 'basic'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          tenant.instanceStatus === 'connected' ? 'bg-green-100 text-green-700' :
                          tenant.instanceStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {tenant.instanceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {tenant.activeError ? (
                          <span className="text-[#d91e2e] font-semibold">{tenant.errorIntegration ?? 'erro'}: {tenant.lastError ?? 'sem detalhe'}</span>
                        ) : (
                          <span className="text-[#6b7280]">Sem erro</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b7280]">
                        {tenant.periodReceived} recebidas / {tenant.periodSent} enviadas
                      </td>
                      <td className="px-4 py-3 text-xs text-[#6b7280]">{fmtDate(tenant.lastActivityAt)}</td>
                      <td className="px-4 py-3 text-xs text-[#6b7280]">{fmtDate(tenant.lastConnectedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/${tenant.slug}/dashboard`} className="text-xs font-semibold text-[#d91e2e] hover:underline">Abrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tenants.length === 0 && <p className="p-8 text-center text-sm text-[#6b7280]">Nenhum cliente encontrado.</p>}
            </div>
          </div>

          <aside className="space-y-5">
            <section className="bg-white rounded-lg p-5">
              <h2 className="font-semibold text-[#1f252b] mb-3">Alertas globais</h2>
              <div className="space-y-3">
                {alertsResult.alerts.map(alert => (
                  <div key={alert.id} className="border rounded-lg p-3">
                    <p className="text-sm font-semibold text-[#1f252b]">{alert.tenants?.name ?? alert.tenant_id}</p>
                    <p className="text-xs text-[#d91e2e]">{alert.integration}: {alert.last_error ?? 'Erro sem detalhe'}</p>
                    <p className="text-xs text-[#6b7280] mt-1">{fmtDate(alert.last_error_at)} · {alert.auto_retry ? 'retry automático' : 'sem retry'}</p>
                  </div>
                ))}
                {alertsResult.alerts.length === 0 && <p className="text-sm text-[#6b7280]">Nenhum erro ativo.</p>}
              </div>
            </section>

            <section className="bg-white rounded-lg p-5">
              <h2 className="font-semibold text-[#1f252b] mb-3">Tipos de mensagem</h2>
              <div className="space-y-2">
                {Object.entries(data.messageTypes).map(([type, totals]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-[#1f252b]">{type}</span>
                    <span className="text-xs text-[#6b7280]">{totals.received} recebidas / {totals.sent} enviadas</span>
                  </div>
                ))}
                {Object.keys(data.messageTypes).length === 0 && <p className="text-sm text-[#6b7280]">Sem mensagens no período.</p>}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
