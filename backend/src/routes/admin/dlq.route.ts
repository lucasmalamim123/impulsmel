import { FastifyInstance } from 'fastify';
import { supabase } from '../../lib/supabase';
import { replayEvent, discardEvent } from '../../domains/dlq/dlq.service';

export async function adminDlqRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/dlq', async (req, reply) => {
    const query = req.query as { status?: string; type?: string; limit?: string; tenantId?: string };
    let q = supabase
      .from('dead_letter_queue')
      .select('id, tenant_id, event_type, error_message, retry_count, status, created_at, last_attempt_at, integration, technical_details, payload, auto_retry, next_retry_at')
      .order('created_at', { ascending: false })
      .limit(Number(query.limit ?? 50));

    if (query.tenantId) q = q.eq('tenant_id', query.tenantId);
    if (query.status) q = q.eq('status', query.status);
    if (query.type) q = q.eq('event_type', query.type);

    const { data, error } = await q;
    if (error) return reply.status(500).send({ error: error.message });
    return reply.send({ events: data });
  });

  app.post('/admin/dlq/simulate', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(403).send({ error: 'DLQ simulation is disabled in production' });
    }

    const body = req.body as { tenantId?: string };
    if (!body.tenantId) return reply.status(400).send({ error: 'tenantId is required' });

    const examples = [
      ['whatsapp_send_failed', 'whatsapp', 'Falha ao enviar mensagem no WhatsApp'],
      ['google_calendar_create_failed', 'google_calendar', 'Falha ao criar evento no Google Calendar'],
      ['notion_lead_failed', 'notion', 'Falha ao registrar lead no Notion'],
      ['external_webhook_failed', 'webhook', 'Falha em webhook externo'],
      ['integration_auth_failed', 'auth', 'Erro de autenticação em integração'],
    ] as const;

    const rows = examples.map(([event_type, integration, error_message]) => ({
      tenant_id: body.tenantId,
      event_type,
      integration,
      error_message,
      payload: { simulated: true, integration, sample: event_type },
      technical_details: { statusCode: integration === 'auth' ? 401 : 503, simulated: true },
      retry_count: 0,
      status: 'pending',
      auto_retry: true,
      next_retry_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));

    const { error } = await supabase.from('dead_letter_queue').insert(rows);
    if (error) return reply.status(500).send({ error: error.message });
    return reply.status(201).send({ ok: true, inserted: rows.length });
  });

  app.get('/admin/dlq/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { data, error } = await supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return reply.status(404).send({ error: 'Not found' });
    return reply.send(data);
  });

  app.post('/admin/dlq/:id/replay', async (req, reply) => {
    const { id } = req.params as { id: string };
    await replayEvent(id);
    return reply.send({ ok: true });
  });

  app.post('/admin/dlq/replay-all', async (req, reply) => {
    const body = req.body as { tenantId?: string };
    let q = supabase
      .from('dead_letter_queue')
      .select('id')
      .eq('status', 'pending')
      .lt('retry_count', 5)
      .limit(50);

    if (body.tenantId) q = q.eq('tenant_id', body.tenantId);
    const { data: events } = await q;

    for (const event of events ?? []) {
      await replayEvent(event.id);
    }

    return reply.send({ ok: true, replayed: events?.length ?? 0 });
  });

  app.patch('/admin/dlq/:id/discard', async (req, reply) => {
    const { id } = req.params as { id: string };
    await discardEvent(id);
    return reply.send({ ok: true });
  });
}
