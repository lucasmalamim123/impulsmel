import { supabase } from '../../lib/supabase';

export type MessageDirection = 'sent' | 'received';
export type IntegrationHealth = 'connected' | 'disconnected' | 'error' | 'pending' | 'unknown';

export function detectMessageType(payload: unknown, fallback = 'text'): string {
  const raw = payload as Record<string, unknown> | undefined;
  if (!raw) return fallback;
  const message = raw.message as Record<string, unknown> | undefined;
  const data = raw.messageData as Record<string, unknown> | undefined;

  const checks: Array<[string, boolean]> = [
    ['button', Boolean(message?.buttonsMessage || data?.buttons || raw.buttons)],
    ['options', Boolean(message?.listMessage || data?.sections || raw.options)],
    ['document', Boolean(message?.documentMessage || data?.document || raw.document)],
    ['audio', Boolean(message?.audioMessage || data?.audio || raw.audio)],
    ['video', Boolean(message?.videoMessage || data?.video || raw.video)],
    ['contact', Boolean(message?.contactMessage || data?.contact || raw.contact)],
    ['image', Boolean(message?.imageMessage || data?.image || raw.image)],
    ['location', Boolean(message?.locationMessage || data?.location || raw.location)],
    ['sticker', Boolean(message?.stickerMessage || data?.sticker || raw.sticker)],
    ['link', typeof raw.text === 'string' && /^https?:\/\//i.test(raw.text)],
  ];

  return checks.find(([, ok]) => ok)?.[0] ?? fallback;
}

export async function recordMessageEvent(params: {
  tenantId?: string;
  direction: MessageDirection;
  messageType?: string;
  channel: string;
  externalEventId?: string;
  metadata?: unknown;
}): Promise<void> {
  const { error } = await supabase.from('message_events').insert({
    tenant_id: params.tenantId,
    direction: params.direction,
    message_type: params.messageType ?? 'text',
    channel: params.channel,
    external_event_id: params.externalEventId,
    metadata: params.metadata ?? {},
  });

  if (error && error.code !== '23505') {
    console.error('[message_events] failed:', error.message);
  }
}

export async function upsertIntegrationStatus(params: {
  tenantId?: string;
  integration: string;
  status: IntegrationHealth;
  lastError?: string | null;
  autoRetry?: boolean;
  retryCount?: number;
  metadata?: unknown;
  lastSyncAt?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const row = {
    tenant_id: params.tenantId,
    integration: params.integration,
    status: params.status,
    last_error: params.lastError ?? (params.status === 'error' ? 'Erro sem detalhe' : null),
    last_error_at: params.status === 'error' ? now : null,
    last_connected_at: params.status === 'connected' ? now : undefined,
    last_sync_at: params.lastSyncAt ?? undefined,
    resolved_at: params.status === 'connected' ? now : null,
    auto_retry: params.autoRetry ?? false,
    retry_count: params.retryCount ?? 0,
    metadata: params.metadata ?? {},
    updated_at: now,
  };

  const { error } = await supabase
    .from('integration_status')
    .upsert(row, { onConflict: 'tenant_id,integration' });

  if (error) console.error('[integration_status] failed:', error.message);
}
