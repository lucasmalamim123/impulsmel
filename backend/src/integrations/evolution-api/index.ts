import axios from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function getEvolutionConfig(tenantId?: string) {
  const [apiUrl, apiKey, instance] = tenantId
    ? await Promise.all([
        getTenantConfigValue(tenantId, 'evolution.api_url'),
        getTenantConfigValue(tenantId, 'evolution.api_key'),
        getTenantConfigValue(tenantId, 'evolution.instance'),
      ])
    : [undefined, undefined, undefined];

  return {
    apiUrl: apiUrl ?? process.env.EVOLUTION_API_URL,
    apiKey: apiKey ?? process.env.EVOLUTION_API_KEY,
    instance: instance ?? process.env.EVOLUTION_INSTANCE,
  };
}

async function createClient(tenantId?: string) {
  const config = await getEvolutionConfig(tenantId);
  return {
    config,
    client: axios.create({
      baseURL: config.apiUrl,
      headers: { apikey: config.apiKey },
    }),
  };
}

export async function sendTextMessage(to: string, text: string, tenantId?: string): Promise<void> {
  const { client, config } = await createClient(tenantId);
  await client.post(`/message/sendText/${config.instance}`, {
    number: to,
    text,
  });
}

export async function getQrCode(tenantId?: string): Promise<string> {
  const { client, config } = await createClient(tenantId);
  const { data } = await client.get(`/instance/connect/${config.instance}`);
  return data.qrcode?.base64 ?? '';
}

export async function getInstanceStatus(tenantId?: string): Promise<string> {
  const { client, config } = await createClient(tenantId);
  const { data } = await client.get(`/instance/connectionState/${config.instance}`);
  return data.instance?.state ?? 'unknown';
}
