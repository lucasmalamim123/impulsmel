export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'rescheduled';

export interface AppointmentRequest {
  tenantId: string;
  customerId: string;
  customerName?: string;
  serviceId?: string;
  serviceType: string;
  requestedAt: string;
  idempotencyKey: string;
  durationMinutes?: number;
  professionalCalendarId?: string;
  professionalId?: string;
  professionalName?: string;
  schedulingMode?: 'individual' | 'group';
  slotCapacity?: number;
}

export interface Appointment {
  id: string;
  tenant_id: string;
  customer_id: string;
  professional_id?: string;
  professional_name?: string;
  service_id?: string;
  service_type: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  gcal_event_id?: string;
  nexfit_eligible?: boolean;
  idempotency_key: string;
  locked_until?: string;
  created_at: string;
  updated_at: string;
}
