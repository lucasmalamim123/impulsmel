import { createMegaApiClient } from '../../../integrations/megaapi';
import { upsertIntegrationStatus } from '../../operational/operational.service';

export async function sendWhatsAppMessage(
  to: string,
  text: string,
  tenantId?: string,
): Promise<void> {
  const { client, config } = await createMegaApiClient(tenantId);
  if (!config.instanceKey) throw new Error('WhatsApp instance is not configured');

  const path = `/rest/sendMessage/${config.instanceKey}/text`;
  const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
  const payload = { messageData: { to: jid, text } };

  console.log('[WA_SEND]', { path, to: jid, tenantId });
  try {
    const { data } = await client.post(path, payload);
    await upsertIntegrationStatus({ tenantId, integration: 'whatsapp', status: 'connected' });
    console.log('[WA_SEND_RESPONSE]', data);
  } catch (error) {
    await upsertIntegrationStatus({
      tenantId,
      integration: 'whatsapp',
      status: 'error',
      lastError: error instanceof Error ? error.message : String(error),
      autoRetry: true,
    });
    throw error;
  }
}
