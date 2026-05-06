import { FastifyInstance } from 'fastify';
import { normalizeMegaApiPayload } from '../../domains/channels/whatsapp/whatsapp.normalizer';
import { handleIncomingMessage } from '../../domains/channels/channel.gateway';
import { isProcessed, markProcessed } from '../../lib/idempotency';
import { findTenantIdByConfigValue, getDefaultTenantId } from '../../domains/tenants/tenant.service';

async function resolveTenantIdFromPayload(payload: Record<string, unknown>): Promise<string> {
  const instance = String(
    payload.instance ??
    payload.instanceKey ??
    payload.instance_key ??
    payload['instanceName'] ??
    '',
  ).trim();

  if (instance) {
    const tenantId =
      await findTenantIdByConfigValue('whatsapp.instance', instance) ??
      await findTenantIdByConfigValue('evolution.instance', instance);
    if (tenantId) return tenantId;
  }

  return getDefaultTenantId();
}

export async function whatsappWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/webhooks/whatsapp', async (req, reply) => {
    const payload = req.body as Record<string, unknown>;
    const eventId = (payload['key'] as Record<string, string>)?.id;
    const tenantId = await resolveTenantIdFromPayload(payload);

    if (!eventId) return reply.status(400).send({ error: 'missing event id' });
    const scopedEventId = `${tenantId}:whatsapp:${eventId}`;
    if (await isProcessed(scopedEventId)) return reply.status(200).send({ duplicate: true });

    await markProcessed(scopedEventId);

    const msg = normalizeMegaApiPayload(
      payload as unknown as Parameters<typeof normalizeMegaApiPayload>[0],
    );

    if (!msg) return reply.status(200).send({ skipped: 'fromMe' });

    const result = await handleIncomingMessage(msg, { tenantId });
    return reply.status(200).send({ ok: true, ...(result ?? {}) });
  });
}
