import { FastifyInstance } from 'fastify';
import { normalizeInstagramPayload } from '../../domains/channels/instagram/instagram.normalizer';
import { normalizeMessengerPayload } from '../../domains/channels/messenger/messenger.normalizer';
import { handleIncomingMessage } from '../../domains/channels/channel.gateway';
import { isProcessed, markProcessed } from '../../lib/idempotency';
import {
  findTenantIdByConfigValue,
  getDefaultTenantId,
  getTenantFeatureFlag,
} from '../../domains/tenants/tenant.service';

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? 'tomazapp_verify';

export async function metaWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.get('/webhooks/meta', async (req, reply) => {
    const query = req.query as Record<string, string>;
    if (
      query['hub.mode'] === 'subscribe' &&
      query['hub.verify_token'] === VERIFY_TOKEN
    ) {
      return reply.status(200).send(query['hub.challenge']);
    }
    return reply.status(403).send({ error: 'Forbidden' });
  });

  app.post('/webhooks/meta', async (req, reply) => {
    const body = req.body as { object: string; entry: unknown[] };

    for (const entry of body.entry ?? []) {
      const entryId = String((entry as { id?: unknown }).id ?? '');
      const tenantId =
        (entryId
          ? await findTenantIdByConfigValue(
              body.object === 'instagram' ? 'instagram.account_id' : 'messenger.page_id',
              entryId,
            )
          : null) ?? await getDefaultTenantId();
      let msg = null;

      if (
        body.object === 'instagram' &&
        await getTenantFeatureFlag(tenantId, 'feature.instagram_enabled')
      ) {
        msg = normalizeInstagramPayload(entry as Parameters<typeof normalizeInstagramPayload>[0]);
      } else if (
        body.object === 'page' &&
        await getTenantFeatureFlag(tenantId, 'feature.messenger_enabled')
      ) {
        msg = normalizeMessengerPayload(entry as Parameters<typeof normalizeMessengerPayload>[0]);
      }

      if (!msg) continue;
      const scopedEventId = `${tenantId}:${msg.channel}:${msg.id}`;
      if (await isProcessed(scopedEventId)) continue;
      await markProcessed(scopedEventId);
      await handleIncomingMessage(msg, { tenantId }).catch(() => {});
    }

    return reply.status(200).send({ ok: true });
  });
}
