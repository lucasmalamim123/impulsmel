import axios from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

export interface MegaApiConfig {
  host: string;
  token?: string;
  instanceKey: string;
}

export interface MegaApiInstanceStatus {
  connected: boolean;
  status: string;
  user?: {
    id?: string;
    name?: string;
  };
  host: string;
  instanceKey: string;
}

function normalizeHost(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return 'https://api2.megaapi.com.br';
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, '');
  return `https://${trimmed.replace(/\/+$/, '')}`;
}

export async function getMegaApiConfig(tenantId?: string): Promise<MegaApiConfig> {
  const [host, token, instanceKey] = tenantId
    ? await Promise.all([
        getTenantConfigValue(tenantId, 'whatsapp.api_url'),
        getTenantConfigValue(tenantId, 'whatsapp.token'),
        getTenantConfigValue(tenantId, 'whatsapp.instance'),
      ])
    : [undefined, undefined, undefined];

  return {
    host: normalizeHost(host ?? process.env.MEGAAPI_HOST),
    token: token ?? process.env.MEGAAPI_TOKEN,
    instanceKey: instanceKey ?? process.env.MEGAAPI_INSTANCE_KEY ?? '',
  };
}

export async function createMegaApiClient(tenantId?: string) {
  const config = await getMegaApiConfig(tenantId);
  return {
    config,
    client: axios.create({
      baseURL: config.host,
      headers: {
        Authorization: config.token ? `Bearer ${config.token}` : undefined,
        'Content-Type': 'application/json',
      },
    }),
  };
}

export async function getQrCode(tenantId?: string): Promise<string> {
  const { client, config } = await createMegaApiClient(tenantId);
  if (!config.instanceKey) throw new Error('WhatsApp instance is not configured');
  const { data } = await client.get(`/rest/instance/qrcode/${config.instanceKey}`);
  return data.qrcode ?? data.qrCode ?? data.qr ?? data.base64 ?? data.image ?? '';
}

export async function getInstanceStatus(tenantId?: string): Promise<MegaApiInstanceStatus> {
  const { client, config } = await createMegaApiClient(tenantId);
  if (!config.instanceKey) throw new Error('WhatsApp instance is not configured');
  const { data } = await client.get(`/rest/instance/${config.instanceKey}`);
  const status = data.instance?.status ?? data.instance_data?.status ?? data.status ?? 'unknown';
  return {
    connected: status === 'connected' || data.instance_data?.phone_connected === true,
    status,
    user: data.instance?.user
      ? { id: data.instance.user.id, name: data.instance.user.name }
      : undefined,
    host: config.host,
    instanceKey: config.instanceKey,
  };
}
