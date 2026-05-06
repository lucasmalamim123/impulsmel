import { Queue, Worker } from 'bullmq';
import { queueConnection, createWorkerConnection } from '../lib/redis';
import { getInstanceStatus, getQrCode } from '../integrations/megaapi';
import { sendTelegramAlert, sendTelegramPhoto } from '../integrations/telegram';
import { logIncident } from '../domains/incidents/incident.service';
import { listActiveTenantIds } from '../domains/tenants/tenant.service';

export const whatsappMonitorQueue = new Queue('whatsapp-monitor', {
  connection: queueConnection,
});

const lastState = new Map<string, boolean>();

export const whatsappMonitorWorker = new Worker(
  'whatsapp-monitor',
  async job => {
    const tenantIds = typeof job.data?.tenantId === 'string'
      ? [job.data.tenantId]
      : await listActiveTenantIds();

    for (const tenantId of tenantIds) {
      const status = await getInstanceStatus(tenantId);
      const connected = status.connected;
      const previous = lastState.get(tenantId);

      if (connected && previous === false) {
        await sendTelegramAlert('WhatsApp reconectado. A instancia esta online novamente.', tenantId);
      }

      if (!connected && previous !== false) {
        await logIncident(
          'high',
          'whatsapp_disconnected',
          'WhatsApp instance lost connection',
          { tenantId },
          tenantId,
        );
        const qr = await getQrCode(tenantId).catch(() => '');
        const msg = 'WhatsApp desconectado. Escaneie o QR code para reconectar ou acesse o painel admin.';
        if (qr) {
          await sendTelegramPhoto(msg, qr, tenantId);
        } else {
          await sendTelegramAlert(msg, tenantId);
        }
      }

      lastState.set(tenantId, connected);
    }
  },
  { connection: createWorkerConnection() },
);
