export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { TenantMetricCharts } from '../../../components/charts/TenantMetricCharts';
import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';

interface Props {
  params: { tenantSlug: string };
}

interface Metrics {
  conversations: number;
  activeConversations: number;
  realTimeAttendances: number;
  appointments: number;
  confirmedAppointments: number;
  cancelledAppointments: number;
  handoffs: number;
  botResolutionRate: number;
  humanTransferRate: number;
  dlqPending: number;
  professionalsCount: number;
  lastRagSync?: string | null;
  monthlySeries: Array<{ day: string; conversations: number; appointments: number; handoffs: number; dlq: number }>;
}

interface WaStatus {
  connected: boolean;
  disconnectedSince?: string | null;
  queueCount?: number;
}

async function getTenantId(slug: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from('tenants').select('id').eq('slug', slug).single();
  return data?.id ?? null;
}

function emptyMetrics(): Metrics {
  return {
    conversations: 0,
    activeConversations: 0,
    realTimeAttendances: 0,
    appointments: 0,
    confirmedAppointments: 0,
    cancelledAppointments: 0,
    handoffs: 0,
    botResolutionRate: 0,
    humanTransferRate: 0,
    dlqPending: 0,
    professionalsCount: 0,
    lastRagSync: null,
    monthlySeries: [],
  };
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function ragAgo(iso: string | null | undefined): string {
  if (!iso) return 'nunca';
  const mins = minutesSince(iso);
  if (mins === null) return 'nunca';
  if (mins < 2) return 'agora mesmo';
  if (mins < 60) return `${mins} min atrás`;
  return `${Math.floor(mins / 60)}h atrás`;
}

function StatCard({
  label,
  value,
  sub,
  href,
  warn,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="group brand-panel flex flex-col gap-3 p-5 transition-all hover:shadow-brand">
      <p className="brand-eyebrow text-[11px]">{label}</p>
      <p className={`font-display text-3xl font-bold ${warn && Number(value) > 0 ? 'text-[#ff404e]' : 'text-[var(--dashboard-text)]'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[var(--dashboard-text-muted)]">{sub}</p>}
      <span className="text-xs font-semibold text-[#ff404e] opacity-0 transition-opacity group-hover:opacity-100">
        Ver →
      </span>
    </Link>
  );
}

function Shortcut({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group brand-panel flex items-center justify-between p-5 transition-all hover:shadow-brand">
      <div>
        <p className="text-sm font-semibold text-[var(--dashboard-text)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">{description}</p>
      </div>
      <span className="text-lg text-[var(--dashboard-text-muted)] transition-colors group-hover:text-[#ff404e]">→</span>
    </Link>
  );
}

export default async function TenantDashboard({ params }: Props) {
  const tenantId = await getTenantId(params.tenantSlug);

  const [metrics, waStatus] = await Promise.all([
    tenantId ? api.get<Metrics>(`/api/tenants/${tenantId}/metrics`).catch(emptyMetrics) : emptyMetrics(),
    tenantId
      ? api.get<WaStatus>(`/api/tenants/${tenantId}/whatsapp/status`).catch((): WaStatus => ({ connected: false }))
      : ({ connected: false } as WaStatus),
  ]);

  const waDisconnectedMins = minutesSince(waStatus.disconnectedSince);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="brand-eyebrow mb-1">Operação</p>
          <h1 className="font-display text-2xl font-bold text-[var(--dashboard-text)]">Dashboard</h1>
          <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">
            Última sincronização RAG: <span className="font-semibold text-[var(--dashboard-text)]">{ragAgo(metrics.lastRagSync)}</span>
          </p>
        </div>
        <Link href={`/${params.tenantSlug}/integracoes`} className="text-xs font-semibold text-[#ff404e] hover:underline">
          Gerenciar integrações →
        </Link>
      </div>

      {!waStatus.connected ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--dashboard-border)] bg-[var(--dashboard-surface-strong)] p-5 shadow-brand">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#d91e2e]/15">
              <span className="text-lg text-[#ff404e]">↗</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--dashboard-text)]">WhatsApp desconectado</p>
              <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">
                {waDisconnectedMins !== null ? `Desconectado há ${waDisconnectedMins}m` : 'Status indisponível'}
                {waStatus.queueCount !== undefined && waStatus.queueCount > 0 && (
                  <span className="ml-2 rounded bg-[#d91e2e]/20 px-1.5 py-0.5 text-[10px] text-[var(--dashboard-text)]">
                    {waStatus.queueCount} em fila
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href={`/${params.tenantSlug}/integracoes`} className="rounded-lg border border-[var(--dashboard-border)] px-3 py-1.5 text-xs text-[var(--dashboard-text)] transition-colors hover:bg-[var(--dashboard-surface)]">
              Ver integrações
            </Link>
            <Link href={`/${params.tenantSlug}/integracoes`} className="rounded-lg bg-[#d91e2e] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#b91523]">
              Reconectar
            </Link>
          </div>
        </div>
      ) : (
        <div className="brand-panel flex items-center gap-4 border-l-4 border-l-[#d91e2e] p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d91e2e]/10">
            <span className="text-sm text-[#ff404e]">✓</span>
          </div>
          <p className="text-sm font-semibold text-[var(--dashboard-text)]">WhatsApp conectado</p>
        </div>
      )}

      <div>
        <p className="brand-eyebrow mb-3">Hoje</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Conversas" value={metrics.conversations} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Agendamentos" value={metrics.appointments} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Handoffs" value={metrics.handoffs} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Erros na fila" value={metrics.dlqPending} href={`/${params.tenantSlug}/dlq`} warn />
        </div>
      </div>

      <div>
        <p className="brand-eyebrow mb-3">Operação em tempo real</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Conversas em andamento" value={metrics.activeConversations} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Atendimentos humanos" value={metrics.realTimeAttendances} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Resolução pelo bot" value={`${metrics.botResolutionRate}%`} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Transferência humana" value={`${metrics.humanTransferRate}%`} href={`/${params.tenantSlug}/auditoria`} />
        </div>
      </div>

      <TenantMetricCharts data={metrics.monthlySeries} />

      <div>
        <p className="brand-eyebrow mb-3">Agendamentos</p>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Concluídos" value={metrics.confirmedAppointments} href={`/${params.tenantSlug}/auditoria?type=appointment`} />
          <StatCard label="Cancelados" value={metrics.cancelledAppointments} href={`/${params.tenantSlug}/auditoria?type=appointment`} warn />
        </div>
      </div>

      <div>
        <p className="brand-eyebrow mb-3">Atalhos rápidos</p>
        <div className="grid grid-cols-2 gap-4">
          <Shortcut href={`/${params.tenantSlug}/profissionais`} title="Profissionais" description={`${metrics.professionalsCount ?? '—'} cadastrados`} />
          <Shortcut href={`/${params.tenantSlug}/integracoes`} title="Integrações" description={waStatus.connected ? 'WhatsApp ativo' : 'Atenção necessária'} />
          <Shortcut href={`/${params.tenantSlug}/dlq`} title="Fila de Erros" description={metrics.dlqPending > 0 ? `${metrics.dlqPending} pendentes` : 'Sem erros pendentes'} />
          <Shortcut href={`/${params.tenantSlug}/auditoria`} title="Auditoria" description="Log de todas as ações" />
        </div>
      </div>
    </div>
  );
}
