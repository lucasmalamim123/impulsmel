import axios, { AxiosError } from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function getChatwootConfig(tenantId?: string) {
  const [apiUrl, apiKey, accountId, inboxId] = tenantId
    ? await Promise.all([
        getTenantConfigValue(tenantId, 'chatwoot.api_url'),
        getTenantConfigValue(tenantId, 'chatwoot.api_key'),
        getTenantConfigValue(tenantId, 'chatwoot.account_id'),
        getTenantConfigValue(tenantId, 'chatwoot.inbox_id'),
      ])
    : [undefined, undefined, undefined, undefined];

  return {
    apiUrl: apiUrl ?? process.env.CHATWOOT_API_URL ?? '',
    apiKey: apiKey ?? process.env.CHATWOOT_API_KEY,
    accountId: Number(accountId ?? process.env.CHATWOOT_ACCOUNT_ID),
    inboxId: Number(inboxId ?? process.env.CHATWOOT_INBOX_ID),
  };
}

async function createClient(tenantId?: string) {
  const config = await getChatwootConfig(tenantId);
  return {
    config,
    client: axios.create({
      baseURL: `${config.apiUrl.replace(/\/$/, '')}/api/v1`,
      headers: { api_access_token: config.apiKey },
    }),
  };
}

function logChatwootError(fn: string, err: unknown): never {
  const e = err as AxiosError;
  const detail = JSON.stringify(e.response?.data ?? e.message);
  console.error(`[chatwoot] ${fn} failed ${e.response?.status}: ${detail}`);
  throw err;
}

export async function sendMessage(
  conversationId: string,
  content: string,
  tenantId?: string,
): Promise<void> {
  const { client, config } = await createClient(tenantId);
  await client.post(
    `/accounts/${config.accountId}/conversations/${conversationId}/messages`,
    { content, message_type: 'outgoing', private: false },
  ).catch(e => logChatwootError('sendMessage', e));
}

export async function findOrCreateContact(
  phone: string,
  name?: string,
  tenantId?: string,
): Promise<string> {
  const { client, config } = await createClient(tenantId);
  const searchRes = await client
    .get(`/accounts/${config.accountId}/contacts/search`, {
      params: { q: phone, include_contacts: true },
    })
    .catch(e => logChatwootError('contacts/search', e));

  const contacts = searchRes.data?.payload?.contacts ?? searchRes.data?.payload ?? [];
  const existing = Array.isArray(contacts) ? contacts[0] : null;
  if (existing?.id) return String(existing.id);

  const createRes = await client
    .post(`/accounts/${config.accountId}/contacts`, {
      phone_number: phone,
      name: name ?? phone,
    })
    .catch(e => logChatwootError('contacts/create', e));

  return String(createRes.data.id);
}

export async function createChatwootConversation(
  contactId: string,
  tenantId?: string,
): Promise<string> {
  const { client, config } = await createClient(tenantId);
  const res = await client
    .post(`/accounts/${config.accountId}/conversations`, {
      contact_id: Number(contactId),
      inbox_id: config.inboxId,
    })
    .catch(e => logChatwootError('conversations/create', e));

  return String(res.data.id);
}

export async function assignAgent(conversationId: string, tenantId?: string): Promise<void> {
  const { client, config } = await createClient(tenantId);
  await client
    .post(`/accounts/${config.accountId}/conversations/${conversationId}/assignments`, {})
    .catch(() => {});
}
