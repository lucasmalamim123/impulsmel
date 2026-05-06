import axios from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function createAsaasClient(tenantId: string) {
  const [apiUrl, apiKey, environment] = await Promise.all([
    getTenantConfigValue(tenantId, 'asaas.api_url'),
    getTenantConfigValue(tenantId, 'asaas.api_key'),
    getTenantConfigValue(tenantId, 'asaas.environment'),
  ]);

  const fallbackUrl = environment === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  return axios.create({
    baseURL: apiUrl ?? process.env.ASAAS_API_URL ?? fallbackUrl,
    headers: { access_token: apiKey ?? process.env.ASAAS_API_KEY },
  });
}

async function findOrCreateAsaasCustomer(params: {
  tenantId: string;
  internalId: string;
  name: string;
  phone: string;
}): Promise<string> {
  const client = await createAsaasClient(params.tenantId);
  const search = await client.get('/customers', {
    params: { externalReference: params.internalId, limit: 1 },
  });

  const found = search.data?.data?.[0];
  if (found) return found.id as string;

  const create = await client.post('/customers', {
    name: params.name || 'Cliente',
    mobilePhone: params.phone.replace(/\D/g, '').slice(-11),
    externalReference: params.internalId,
    notificationDisabled: true,
  });

  return create.data.id as string;
}

export async function createCharge(params: {
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  idempotencyKey: string;
  description?: string;
}): Promise<{ id: string; invoiceUrl?: string }> {
  const client = await createAsaasClient(params.tenantId);
  const asaasCustomerId = await findOrCreateAsaasCustomer({
    tenantId: params.tenantId,
    internalId: params.customerId,
    name: params.customerName,
    phone: params.customerPhone,
  });

  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const { data } = await client.post('/payments', {
    customer: asaasCustomerId,
    billingType: 'UNDEFINED',
    value: params.amount,
    dueDate,
    externalReference: params.idempotencyKey,
    description: params.description,
  });

  return { id: data.id as string, invoiceUrl: data.invoiceUrl as string | undefined };
}
