export const dynamic = 'force-dynamic';

import { api } from '../../../lib/api';
import { createAdminClient } from '../../../lib/supabase/admin-client';
import { replayOne, replayAll, discardOne, simulateDlq } from './actions';

interface Props { params: { tenantSlug: string } }

interface DlqEvent {
  id: string;
  event_type: string;
  error_message: string;
  retry_count: number;
  status: string;
  created_at: string;
  tenant_id?: string;
  integration?: string | null;
  technical_details?: unknown;
  payload?: unknown;
  auto_retry?: boolean;
  next_retry_at?: string | null;
}

export default async function DlqPage({ params }: Props) {
  const supabase = createAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('id').eq('slug', params.tenantSlug).single();
  const tenantId = tenant?.id;

  const { events } = await api
    .get<{ events: DlqEvent[] }>(`/admin/dlq?status=pending&limit=100${tenantId ? `&tenantId=${tenantId}` : ''}`)
    .catch(() => ({ events: [] as DlqEvent[] }));

  const replayAllAction = replayAll.bind(null, params.tenantSlug, tenantId);
  const simulateAction = simulateDlq.bind(null, params.tenantSlug, tenantId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fila de Erros</h1>
        <div className="flex gap-2">
          <form action={simulateAction}>
            <button type="submit" className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50">
              Simular erros
            </button>
          </form>
          {events.length > 0 && (
            <form action={replayAllAction}>
              <button type="submit" className="bg-blue-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700">
                Replay todos ({events.length})
              </button>
            </form>
          )}
        </div>
      </div>

      {events.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <p className="text-green-700 font-medium">Nenhum erro pendente 🎉</p>
        </div>
      )}

      <div className="space-y-3">
        {events.map(ev => {
          const replay = replayOne.bind(null, params.tenantSlug, ev.id);
          const discard = discardOne.bind(null, params.tenantSlug, ev.id);

          return (
            <div key={ev.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                      {ev.event_type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {ev.retry_count} tentativa{ev.retry_count !== 1 ? 's' : ''}
                    </span>
                    {ev.integration && (
                      <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">
                        {ev.integration}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-red-600 font-mono break-all">{ev.error_message}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(ev.created_at).toLocaleString('pt-BR')}
                    {ev.next_retry_at ? ` · próximo retry ${new Date(ev.next_retry_at).toLocaleString('pt-BR')}` : ''}
                    {ev.auto_retry ? ' · retry automático' : ' · sem retry automático'}
                  </p>
                  <details className="mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer">Detalhes técnicos e payload</summary>
                    <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-[11px] overflow-auto max-h-64">
                      {JSON.stringify({ technical_details: ev.technical_details, payload: ev.payload }, null, 2)}
                    </pre>
                  </details>
                </div>
                <div className="flex gap-2 shrink-0">
                  <form action={replay}>
                    <button type="submit" className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-100">
                      Replay
                    </button>
                  </form>
                  <form action={discard}>
                    <button type="submit" className="text-xs bg-gray-50 text-gray-500 px-3 py-1 rounded-lg hover:bg-gray-100">
                      Descartar
                    </button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
