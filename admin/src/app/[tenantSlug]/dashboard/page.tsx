export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';

interface Props { params: { tenantSlug: string } }

interface Metrics {
  conversations: number;
  appointments: number;
  handoffs: number;
  dlqPending: number;
  professionalsCount: number;
  lastRagSync?: string | null;
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
  label, value, sub, href, warn,
}: {
  label: string;
  value: number | string;
  sub?: string;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="group brand-panel p-5 hover:shadow-brand transition-all flex flex-col gap-3">
      <p className="brand-eyebrow text-[11px]">{label}</p>
      <p className={`font-display text-3xl font-bold ${warn && Number(value) > 0 ? 'text-[#d91e2e]' : 'text-[#1f252b]'}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#6b7280]">{sub}</p>}
      <span className="text-xs font-semibold text-[#d91e2e] opacity-0 group-hover:opacity-100 transition-opacity">
        Ver →
      </span>
    </Link>
  );
}

function Shortcut({
  href, title, description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group brand-panel p-5 hover:shadow-brand transition-all flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-[#1f252b]">{title}</p>
        <p className="text-xs text-[#6b7280] mt-0.5">{description}</p>
      </div>
      <span className="text-[#6b7280] group-hover:text-[#d91e2e] transition-colors text-lg">→</span>
    </Link>
  );
}

export default async function TenantDashboard({ params }: Props) {
  const tenantId = await getTenantId(params.tenantSlug);

  const [metrics, waStatus] = await Promise.all([
    tenantId
      ? api.get<Metrics>(`/api/tenants/${tenantId}/metrics`).catch((): Metrics => ({
          conversations: 0, appointments: 0, handoffs: 0,
          dlqPending: 0, professionalsCount: 0, lastRagSync: null,
        }))
      : ({ conversations: 0, appointments: 0, handoffs: 0, dlqPending: 0, professionalsCount: 0, lastRagSync: null } as Metrics),
    api.get<WaStatus>('/api/whatsapp/status').catch((): WaStatus => ({ connected: false })),
  ]);

  const waDisconnectedMins = minutesSince(waStatus.disconnectedSince);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="brand-eyebrow mb-1">Operação</p>
          <h1 className="font-display text-2xl font-bold text-[#1f252b]">Dashboard</h1>
          <p className="text-xs text-[#6b7280] mt-0.5">
            Última sincronização RAG: <span className="text-[#1f252b]">{ragAgo(metrics?.lastRagSync)}</span>
          </p>
        </div>
        <Link href={`/${params.tenantSlug}/integracoes`} className="text-xs font-semibold text-[#d91e2e] hover:underline">
          Gerenciar integrações →
        </Link>
      </div>

      {!waStatus.connected ? (
        <div className="bg-[#1f252b] rounded-lg p-5 flex items-center justify-between gap-4 shadow-brand">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#d91e2e]/15 flex items-center justify-center shrink-0">
              <span className="text-[#d91e2e] text-lg">↗</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">WhatsApp desconectado</p>
              <p className="text-xs text-white/45 mt-0.5">
                {waDisconnectedMins !== null ? `Desconectado há ${waDisconnectedMins}m` : 'Status indisponível'}
                {waStatus.queueCount !== undefined && waStatus.queueCount > 0 && (
                  <span className="ml-2 bg-[#d91e2e]/20 text-white px-1.5 py-0.5 rounded text-[10px]">
                    {waStatus.queueCount} em fila
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href={`/${params.tenantSlug}/integracoes`} className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-white/75 hover:bg-white/12 transition-colors">
              Ver integrações
            </Link>
            <Link href={`/${params.tenantSlug}/integracoes/whatsapp`} className="text-xs px-3 py-1.5 rounded-lg bg-[#d91e2e] text-white hover:bg-[#b91523] transition-colors font-semibold">
              Reconectar
            </Link>
          </div>
        </div>
      ) : (
        <div className="brand-panel p-4 flex items-center gap-4 border-l-4 border-l-[#d91e2e]">
          <div className="w-8 h-8 rounded-lg bg-[#d91e2e]/10 flex items-center justify-center shrink-0">
            <span className="text-[#d91e2e] text-sm">✓</span>
          </div>
          <p className="text-sm text-[#1f252b] font-semibold">WhatsApp conectado</p>
        </div>
      )}

      <div>
        <p className="brand-eyebrow mb-3">Hoje</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Conversas" value={metrics?.conversations ?? 0} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Agendamentos" value={metrics?.appointments ?? 0} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Handoffs" value={metrics?.handoffs ?? 0} href={`/${params.tenantSlug}/auditoria`} />
          <StatCard label="Erros na fila" value={metrics?.dlqPending ?? 0} href={`/${params.tenantSlug}/dlq`} warn />
        </div>
      </div>

      <div>
        <p className="brand-eyebrow mb-3">Atalhos rápidos</p>
        <div className="grid grid-cols-2 gap-4">
          <Shortcut href={`/${params.tenantSlug}/profissionais`} title="Profissionais" description={`${metrics?.professionalsCount ?? '—'} cadastrados`} />
          <Shortcut href={`/${params.tenantSlug}/integracoes`} title="Integrações" description={waStatus.connected ? 'WhatsApp ativo' : 'Atenção necessária'} />
          <Shortcut href={`/${params.tenantSlug}/dlq`} title="Fila de Erros" description={(metrics?.dlqPending ?? 0) > 0 ? `${metrics!.dlqPending} pendentes` : 'Sem erros pendentes'} />
          <Shortcut href={`/${params.tenantSlug}/auditoria`} title="Auditoria" description="Log de todas as ações" />
        </div>
      </div>
    </div>
  );
}
