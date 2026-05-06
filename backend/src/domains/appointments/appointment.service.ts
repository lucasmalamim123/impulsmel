import {
  createAppointment,
  findByIdempotencyKey,
  findById,
  findUpcomingByCustomer,
  updateStatus,
  countConfirmedForSlot,
} from './appointment.repository';
import { AppointmentRequest, Appointment } from './appointment.types';
import { createEvent, deleteEvent, checkSlotAvailability } from '../../integrations/google-calendar';
import { checkEligibility } from '../../integrations/nexfit';
import { logAudit } from '../audit/audit.service';
import { reminderQueue } from '../../jobs/reminder.job';
import { getTenantReminderHours } from '../tenants/tenant.service';

export { findUpcomingByCustomer, findById };

export async function scheduleAppointment(req: AppointmentRequest): Promise<Appointment> {
  const existing = await findByIdempotencyKey(req.tenantId, req.idempotencyKey);
  if (existing) return existing;

  const calendarId = req.professionalCalendarId ?? 'primary';
  const duration = req.durationMinutes ?? 60;
  const schedulingMode = req.schedulingMode ?? 'individual';
  const slotCapacity = Math.max(1, req.slotCapacity ?? 1);

  if (schedulingMode === 'group') {
    if (!req.professionalId) throw new Error('PROFESSIONAL_REQUIRED');
    const occupied = await countConfirmedForSlot({
      tenantId: req.tenantId,
      professionalId: req.professionalId,
      serviceId: req.serviceId,
      serviceType: req.serviceType,
      scheduledAt: req.requestedAt,
    });
    if (occupied >= slotCapacity) throw new Error('SLOT_FULL');
  } else {
    const available = await checkSlotAvailability(req.requestedAt, duration, calendarId, req.tenantId);
    if (!available) throw new Error('SLOT_UNAVAILABLE');
    if (req.professionalId) {
      const occupied = await countConfirmedForSlot({
        tenantId: req.tenantId,
        professionalId: req.professionalId,
        serviceId: req.serviceId,
        serviceType: req.serviceType,
        scheduledAt: req.requestedAt,
      });
      if (occupied > 0) throw new Error('SLOT_UNAVAILABLE');
    }
  }

  const nexfitEligible = await checkEligibility(req.customerId, req.tenantId);

  const gcalEvent = await createEvent({
    tenantId: req.tenantId,
    customerId: req.customerId,
    serviceType: req.serviceType,
    scheduledAt: req.requestedAt,
    durationMinutes: duration,
    calendarId,
    professionalName: req.professionalName,
    customerName: req.customerName,
  });

  const appointment = await createAppointment({
    tenant_id: req.tenantId,
    customer_id: req.customerId,
    professional_id: req.professionalId,
    professional_name: req.professionalName,
    service_id: req.serviceId,
    service_type: req.serviceType,
    scheduled_at: req.requestedAt,
    duration_minutes: duration,
    status: 'confirmed',
    gcal_event_id: gcalEvent.id,
    nexfit_eligible: nexfitEligible,
    idempotency_key: req.idempotencyKey,
  });

  await logAudit({
    tenant_id: req.tenantId,
    entity_type: 'appointment',
    entity_id: appointment.id,
    action: 'created',
    actor: 'bot',
    after_state: appointment,
  });

  const reminderHours = await getTenantReminderHours(req.tenantId);
  for (const hoursBefore of reminderHours) {
    const reminderDelay = new Date(req.requestedAt).getTime() - hoursBefore * 60 * 60 * 1000 - Date.now();
    if (reminderDelay > 0) {
      reminderQueue
        .add('appointment-reminder', { appointmentId: appointment.id, hoursBefore }, {
          delay: reminderDelay,
          jobId: `reminder-${appointment.id}-${hoursBefore}`,
        })
        .catch(() => {});
    }
  }

  return appointment;
}

export async function cancelAppointment(
  appointmentId: string,
  customerId: string,
  reason: string,
  tenantId?: string,
): Promise<Appointment> {
  const appointment = await findById(appointmentId, tenantId);
  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
  if (appointment.customer_id !== customerId) throw new Error('NOT_OWNER');
  if (appointment.status === 'cancelled') return appointment;

  if (appointment.gcal_event_id) {
    await deleteEvent(appointment.gcal_event_id, 'primary', appointment.tenant_id).catch(err => {
      console.error('[CANCEL_GCAL_ERROR]', err);
    });
  }

  await updateStatus(appointmentId, 'cancelled');

  await logAudit({
    tenant_id: appointment.tenant_id,
    entity_type: 'appointment',
    entity_id: appointmentId,
    action: 'cancelled',
    actor: 'bot',
    before_state: appointment,
    after_state: { ...appointment, status: 'cancelled', reason },
  });

  return { ...appointment, status: 'cancelled' };
}

export async function rescheduleAppointment(
  appointmentId: string,
  customerId: string,
  newScheduledAt: string,           // ISO datetime
  options: {
    calendarId?: string;
    professionalId?: string;
    professionalName?: string;
    tenantId?: string;
    schedulingMode?: 'individual' | 'group';
    slotCapacity?: number;
  } = {},
): Promise<Appointment> {
  const appointment = await findById(appointmentId, options.tenantId);
  if (!appointment) throw new Error('APPOINTMENT_NOT_FOUND');
  if (appointment.customer_id !== customerId) throw new Error('NOT_OWNER');
  if (appointment.status === 'cancelled') throw new Error('ALREADY_CANCELLED');

  const calendarId = options.calendarId ?? 'primary';
  const duration = appointment.duration_minutes ?? 60;
  const professionalId = options.professionalId ?? appointment.professional_id;
  const professionalName = options.professionalName ?? appointment.professional_name;
  const schedulingMode = options.schedulingMode ?? 'individual';

  if (schedulingMode === 'group') {
    if (!professionalId) throw new Error('PROFESSIONAL_REQUIRED');
    const occupied = await countConfirmedForSlot({
      tenantId: appointment.tenant_id,
      professionalId,
      serviceId: appointment.service_id,
      serviceType: appointment.service_type,
      scheduledAt: newScheduledAt,
      excludeAppointmentId: appointment.id,
    });
    if (occupied >= Math.max(1, options.slotCapacity ?? 1)) throw new Error('SLOT_FULL');
  } else {
    const available = await checkSlotAvailability(newScheduledAt, duration, calendarId, appointment.tenant_id);
    if (!available) throw new Error('SLOT_UNAVAILABLE');
    if (professionalId) {
      const occupied = await countConfirmedForSlot({
        tenantId: appointment.tenant_id,
        professionalId,
        serviceId: appointment.service_id,
        serviceType: appointment.service_type,
        scheduledAt: newScheduledAt,
        excludeAppointmentId: appointment.id,
      });
      if (occupied > 0) throw new Error('SLOT_UNAVAILABLE');
    }
  }

  // Apaga o evento antigo, cria o novo
  if (appointment.gcal_event_id) {
    await deleteEvent(appointment.gcal_event_id, calendarId, appointment.tenant_id).catch(err => {
      console.error('[RESCHEDULE_DELETE_ERROR]', err);
    });
  }

  const newEvent = await createEvent({
    tenantId: appointment.tenant_id,
    customerId,
    serviceType: appointment.service_type,
    scheduledAt: newScheduledAt,
    durationMinutes: duration,
    calendarId,
    professionalName,
  });

  await updateStatus(appointmentId, 'rescheduled', newEvent.id);

  // Atualiza o scheduled_at também
  const { error } = await (await import('../../lib/supabase')).supabase
    .from('appointments')
    .update({ scheduled_at: newScheduledAt, status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', appointmentId);
  if (error) throw error;

  await logAudit({
    tenant_id: appointment.tenant_id,
    entity_type: 'appointment',
    entity_id: appointmentId,
    action: 'rescheduled',
    actor: 'bot',
    before_state: appointment,
    after_state: { ...appointment, scheduled_at: newScheduledAt, gcal_event_id: newEvent.id },
  });

  return { ...appointment, scheduled_at: newScheduledAt, gcal_event_id: newEvent.id, status: 'confirmed' };
}
