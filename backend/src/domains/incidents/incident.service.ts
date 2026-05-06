import { supabase } from '../../lib/supabase';
import { sendTelegramAlert } from '../../integrations/telegram';

type Severity = 'low' | 'medium' | 'high' | 'critical';

export async function logIncident(
  severity: Severity,
  type: string,
  description: string,
  metadata?: Record<string, unknown>,
  tenantId?: string,
): Promise<void> {
  const { error } = await supabase.from('incidents').insert({
    tenant_id: tenantId,
    severity,
    type,
    description,
    metadata: metadata ?? {},
  });

  if (error) console.error('[incidents] failed to log:', error.message);

  if (severity === 'critical' || severity === 'high') {
    await sendTelegramAlert(`[${severity.toUpperCase()}] ${type}: ${description}`, tenantId).catch(() => {});
  }
}
