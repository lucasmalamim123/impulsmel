import Link from 'next/link';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  Globe2,
  Mail,
  MonitorCheck,
  MonitorX,
  Plus,
  Puzzle,
  Send,
  Settings,
  TrendingDown,
  TrendingUp,
  UserRoundX,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { ImpulsmelMark } from '../../components/brand/ImpulsmelMark';
import { ThemeToggle } from '../../components/theme/ThemeToggle';
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

const statCards: Array<{
  label: string;
  key: keyof DashboardData['summary'];
  icon: LucideIcon;
  tone: string;
}> = [
  { label: 'Total de clientes', key: 'totalTenants', icon: UsersRound, tone: 'danger' },
  { label: 'Instâncias web conectadas', key: 'webInstancesConnected', icon: MonitorCheck, tone: 'success' },
  { label: 'Instâncias web desconectadas', key: 'webInstancesDisconnected', icon: MonitorX, tone: 'warning' },
  { label: 'Mensagens enviadas', key: 'totalSent', icon: Send, tone: 'blue' },
  { label: 'Mensagens recebidas', key: 'totalReceived', icon: Mail, tone: 'purple' },
  { label: 'Enviadas no mês', key: 'monthSent', icon: TrendingUp, tone: 'cyan' },
  { label: 'Recebidas no mês', key: 'monthReceived', icon: TrendingDown, tone: 'violet' },
  { label: 'Clientes com erro', key: 'tenantsWithActiveError', icon: UserRoundX, tone: 'danger' },
  { label: 'Integrações com erro', key: 'integrationsWithError', icon: Puzzle, tone: 'rose' },
  { label: 'DLQ pendente', key: 'dlqPending', icon: Database, tone: 'slate' },
];

function fmtDate(value: string | null) {
  if (!value) return 'Sem registro';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function toneClasses(tone: string) {
  const tones: Record<string, string> = {
    danger: 'bg-[#d91e2e]/20 text-[#ff626f] shadow-[#d91e2e]/20',
    success: 'bg-emerald-500/20 text-emerald-300 shadow-emerald-500/20',
    warning: 'bg-amber-500/20 text-amber-300 shadow-amber-500/20',
    blue: 'bg-blue-500/20 text-blue-300 shadow-blue-500/20',
    purple: 'bg-purple-500/20 text-purple-300 shadow-purple-500/20',
    cyan: 'bg-cyan-500/20 text-cyan-300 shadow-cyan-500/20',
    violet: 'bg-violet-500/20 text-violet-300 shadow-violet-500/20',
    rose: 'bg-rose-500/20 text-rose-300 shadow-rose-500/20',
    slate: 'bg-slate-500/20 text-slate-300 shadow-slate-500/20',
  };
  return tones[tone] ?? tones.slate;
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="min-h-[104px] rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-4 shadow-[var(--dashboard-shadow)]">
      <div className="flex h-full items-center gap-4">
        <div className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-lg shadow-lg ${toneClasses(tone)}`}>
          <Icon className="h-8 w-8" strokeWidth={2.1} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase leading-tight text-[var(--dashboard-text-muted)]">
            {label}
          </p>
          <p className="mt-1 font-display text-3xl font-bold leading-none text-[var(--dashboard-text)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  icon: Icon,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: string[][];
  icon: LucideIcon;
}) {
  return (
    <label className="block min-w-[204px] text-xs font-medium text-[var(--dashboard-text-soft)]">
      {label}
      <span className="relative mt-2 block">
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--dashboard-text-muted)]" />
        <select
          name={name}
          defaultValue={defaultValue}
          className="h-12 w-full appearance-none rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-control)] py-0 pl-12 pr-10 text-sm font-semibold text-[var(--dashboard-text)] shadow-sm outline-none transition-colors hover:border-[var(--brand-red)] focus:border-[var(--brand-red)] focus:ring-2 focus:ring-[#d91e2e]/25"
        >
          {options.map(([value, optionLabel]) => (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--dashboard-text-muted)]" />
      </span>
    </label>
  );
}

function statusStyle(status: string) {
  if (status === 'connected') return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  if (status === 'error') return 'border-[#d91e2e]/40 bg-[#d91e2e]/15 text-[#ff626f]';
  return 'border-[var(--dashboard-border)] bg-[var(--dashboard-surface-strong)] text-[var(--dashboard-text-muted)]';
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
        totalTenants: 0,
        webInstancesRunning: 0,
        webInstancesConnected: 0,
        webInstancesDisconnected: 0,
        totalSent: 0,
        totalReceived: 0,
        monthSent: 0,
        monthReceived: 0,
        tenantsWithActiveError: 0,
        integrationsWithError: 0,
        dlqPending: 0,
      },
      messageTypes: {},
      tenants: [],
    })),
    api.get<{ alerts: AlertRow[] }>('/api/admin/global-alerts').catch(() => ({ alerts: [] })),
  ]);

  const alertsHref = `/dashboard?period=${encodeURIComponent(searchParams.period ?? 'today')}&instanceStatus=with_error`;
  const primaryAlert = alertsResult.alerts[0];

  return (
    <div className="min-h-screen bg-[var(--dashboard-bg)] text-[var(--dashboard-text)]">
      <header className="flex min-h-[92px] items-center justify-between border-b border-[var(--dashboard-border-soft)] px-6 py-4 sm:px-10">
        <Link href="/dashboard" className="block">
          <ImpulsmelMark />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/admin/tenants/novo"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#f21f2f] px-5 text-sm font-bold text-white shadow-lg shadow-[#d91e2e]/20 transition-colors hover:bg-[#d91e2e]"
          >
            <Plus className="h-5 w-5" />
            Novo cliente
          </Link>
        </div>
      </header>

      <main className="px-6 py-8 sm:px-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.02em] text-[#ff404e]">
              Operação global
            </p>
            <h1 className="font-display text-3xl font-bold leading-tight text-[var(--dashboard-text)]">
              Visão geral dos clientes
            </h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-[var(--dashboard-text-muted)]">
              <CalendarDays className="h-4 w-4" />
              Período: {fmtDate(data.range.from)} até {fmtDate(data.range.to)}
            </p>
          </div>

          <form className="flex flex-wrap items-end gap-4">
            <SelectField
              label="Período"
              name="period"
              defaultValue={searchParams.period ?? 'today'}
              options={PERIODS}
              icon={CalendarDays}
            />
            <SelectField
              label="Instância web"
              name="instanceStatus"
              defaultValue={searchParams.instanceStatus ?? 'all'}
              options={STATUSES}
              icon={Globe2}
            />
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#f21f2f] px-5 text-sm font-bold text-white shadow-lg shadow-[#d91e2e]/20 transition-colors hover:bg-[#d91e2e]">
              <Filter className="h-5 w-5" />
              Filtrar
            </button>
          </form>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {statCards.map(card => (
            <StatCard
              key={card.key}
              label={card.label}
              value={data.summary[card.key]}
              icon={card.icon}
              tone={card.tone}
            />
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_414px]">
          <div className="overflow-hidden rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] shadow-[var(--dashboard-shadow)]">
            <div className="flex min-h-[66px] items-center justify-between border-b border-[var(--dashboard-border)] px-5">
              <h2 className="flex items-center gap-3 font-display text-xl font-bold text-[var(--dashboard-text)]">
                <UsersRound className="h-5 w-5 text-[#ff404e]" />
                Clientes
              </h2>
              <Link
                href="/admin/tenants"
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d91e2e]/35 px-3 text-xs font-bold text-[#ff404e] transition-colors hover:bg-[#d91e2e]/10"
              >
                <Settings className="h-4 w-4" />
                Gerenciar
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--dashboard-border)] text-left text-sm font-medium text-[var(--dashboard-text-muted)]">
                    <th className="px-5 py-4 font-medium">Cliente</th>
                    <th className="px-5 py-4 font-medium">Plano</th>
                    <th className="px-5 py-4 font-medium">WhatsApp</th>
                    <th className="px-5 py-4 font-medium">Erro ativo</th>
                    <th className="px-5 py-4 font-medium">Volume</th>
                    <th className="px-5 py-4 font-medium">Última atividade</th>
                    <th className="px-5 py-4 font-medium">Última conexão</th>
                    <th className="px-5 py-4" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--dashboard-border)]">
                  {data.tenants.map(tenant => (
                    <tr key={tenant.id} className="transition-colors hover:bg-[var(--dashboard-surface-strong)]">
                      <td className="px-5 py-5 align-top">
                        <p className="font-bold text-[var(--dashboard-text)]">{tenant.name}</p>
                        <p className="text-sm text-[var(--dashboard-text-muted)]">{tenant.slug}</p>
                      </td>
                      <td className="px-5 py-5 align-top text-sm font-semibold uppercase text-[var(--dashboard-text)]">
                        {tenant.plan ?? 'basic'}
                      </td>
                      <td className="px-5 py-5 align-top">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusStyle(tenant.instanceStatus)}`}>
                          {tenant.instanceStatus}
                        </span>
                      </td>
                      <td className="max-w-[410px] px-5 py-5 align-top text-sm">
                        {tenant.activeError ? (
                          <span className="font-semibold leading-relaxed text-[#ff4b57]">
                            {tenant.errorIntegration ?? 'erro'}: {tenant.lastError ?? 'sem detalhe'}
                          </span>
                        ) : (
                          <span className="text-[var(--dashboard-text-muted)]">Sem erro</span>
                        )}
                      </td>
                      <td className="px-5 py-5 align-top text-sm text-[var(--dashboard-text-muted)]">
                        {tenant.periodReceived} recebidas /<br />
                        {tenant.periodSent} enviadas
                      </td>
                      <td className="px-5 py-5 align-top text-sm text-[var(--dashboard-text-muted)]">
                        {fmtDate(tenant.lastActivityAt)}
                      </td>
                      <td className="px-5 py-5 align-top text-sm text-[var(--dashboard-text-muted)]">
                        {fmtDate(tenant.lastConnectedAt)}
                      </td>
                      <td className="px-5 py-5 align-top text-right">
                        <Link
                          href={`/${tenant.slug}/dashboard`}
                          className="inline-flex items-center gap-1 text-sm font-bold text-[#ff404e] transition-colors hover:text-[#d91e2e]"
                        >
                          Abrir
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.tenants.length === 0 && (
                <p className="p-8 text-center text-sm text-[var(--dashboard-text-muted)]">
                  Nenhum cliente encontrado.
                </p>
              )}
            </div>
          </div>

          <aside className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] p-5 shadow-[var(--dashboard-shadow)]">
            <h2 className="mb-5 flex items-center gap-3 font-display text-xl font-bold text-[var(--dashboard-text)]">
              <Bell className="h-5 w-5 text-[#ff404e]" />
              Alertas globais
            </h2>

            {primaryAlert ? (
              <div className="rounded-lg border border-[#d91e2e]/35 bg-[#d91e2e]/10 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#ff404e]" />
                  <p className="font-display text-lg font-bold text-[var(--dashboard-text)]">
                    {primaryAlert.tenants?.name ?? primaryAlert.tenant_id}
                  </p>
                </div>
                <p className="text-sm font-semibold leading-relaxed text-[#ff4b57]">
                  {primaryAlert.integration}: {primaryAlert.last_error ?? 'Erro sem detalhe'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-strong)] p-5">
                <p className="text-sm font-semibold text-[var(--dashboard-text)]">
                  Nenhum erro ativo.
                </p>
                <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">
                  As integrações não registraram alertas globais pendentes.
                </p>
              </div>
            )}

            <Link
              href={alertsHref}
              className="mt-4 flex h-14 items-center justify-between rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-strong)] px-4 text-sm font-semibold text-[var(--dashboard-text)] transition-colors hover:border-[#d91e2e]/45 hover:text-[#ff404e]"
            >
              Ver todos os alertas
              <ChevronRight className="h-5 w-5" />
            </Link>
          </aside>
        </section>
      </main>
    </div>
  );
}
