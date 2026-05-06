import axios from 'axios';
import { getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function createNexfitClient(tenantId: string) {
  const [apiUrl, apiKey] = await Promise.all([
    getTenantConfigValue(tenantId, 'nexfit.api_url'),
    getTenantConfigValue(tenantId, 'nexfit.api_key'),
  ]);

  return axios.create({
    baseURL: apiUrl ?? process.env.NEXFIT_API_URL,
    headers: { Authorization: `Bearer ${apiKey ?? process.env.NEXFIT_API_KEY}` },
  });
}

export async function checkEligibility(customerId: string, tenantId: string): Promise<boolean> {
  const enabled = await getTenantConfigValue(tenantId, 'nexfit.check_eligibility');
  if (!((enabled as unknown) === true || enabled === 'true')) return true;

  try {
    const client = await createNexfitClient(tenantId);
    const { data } = await client.get(`/members/${customerId}/eligibility`);
    return data.eligible === true;
  } catch {
    return false;
  }
}
