import { google } from 'googleapis';
import { TenantScheduleConfig, getTenantConfigValue } from '../../domains/tenants/tenant.service';

async function createCalendarClient(tenantId?: string) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const refreshToken = tenantId
    ? await getTenantConfigValue(tenantId, 'gcal.refresh_token')
    : undefined;

  auth.setCredentials({ refresh_token: refreshToken ?? process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth });
}

const TZ_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function toLocal(utcDate: Date): Date {
  return new Date(utcDate.getTime() + TZ_OFFSET_MS);
}

function formatSlotLabel(utcDate: Date): string {
  const local = toLocal(utcDate);
  const dayName = DAYS_PT[local.getUTCDay()];
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  const hour = String(local.getUTCHours()).padStart(2, '0');
  const min = local.getUTCMinutes();
  const minStr = min === 0 ? '' : String(min).padStart(2, '0');
  return `${dayName}, ${day}/${month} às ${hour}h${minStr}`;
}

const DEFAULT_BUSINESS_HOURS: TenantScheduleConfig['businessHours'] = {
  mon: [{ open: '08:00', close: '20:00' }],
  tue: [{ open: '08:00', close: '20:00' }],
  wed: [{ open: '08:00', close: '20:00' }],
  thu: [{ open: '08:00', close: '20:00' }],
  fri: [{ open: '08:00', close: '20:00' }],
  sat: null,
  sun: null,
};

function getBusinessHoursForDay(
  localDate: Date,
  businessHours: TenantScheduleConfig['businessHours'],
): { openH: number; openM: number; closeH: number; closeM: number }[] {
  const dayKey = DAY_KEYS[localDate.getUTCDay()];
  const hours = businessHours[dayKey] ?? null;
  if (!hours) return [];

  return hours.map(block => {
    const [openH, openM] = block.open.split(':').map(Number);
    const [closeH, closeM] = block.close.split(':').map(Number);
    return { openH, openM, closeH, closeM };
  });
}

export interface AvailableSlot {
  label: string;
  iso: string;
  remainingSeats?: number;
}

export interface ListSlotsOptions {
  tenantId?: string;
  calendarId?: string;
  durationMinutes?: number;
  daysAhead?: number;
  slotIntervalMinutes?: number;
  maxSlots?: number;
  businessHours?: TenantScheduleConfig['businessHours'];
  ignoreBusy?: boolean;
}

export async function listAvailableSlots(options: ListSlotsOptions = {}): Promise<AvailableSlot[]> {
  const {
    tenantId,
    calendarId = 'primary',
    durationMinutes = 60,
    daysAhead = 7,
    slotIntervalMinutes = 60,
    maxSlots = 5,
    businessHours = DEFAULT_BUSINESS_HOURS,
    ignoreBusy = false,
  } = options;

  const calendar = await createCalendarClient(tenantId);
  const now = new Date();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: now.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busyPeriods = (data.calendars?.[calendarId]?.busy ?? []).map(b => ({
    start: new Date(b.start!).getTime(),
    end: new Date(b.end!).getTime(),
  }));

  const slots: AvailableSlot[] = [];
  const cursor = new Date(now.getTime() + 30 * 60 * 1000);
  cursor.setMinutes(0, 0, 0);
  cursor.setTime(cursor.getTime() + slotIntervalMinutes * 60 * 1000);

  while (cursor < timeMax && slots.length < maxSlots) {
    const local = toLocal(cursor);
    const dayBlocks = getBusinessHoursForDay(local, businessHours);

    if (!dayBlocks.length) {
      const nextDay = new Date(local.getTime() + 24 * 60 * 60 * 1000);
      nextDay.setUTCHours(0, 0, 0, 0);
      cursor.setTime(nextDay.getTime() - TZ_OFFSET_MS);
      continue;
    }

    const localMinutes = local.getUTCHours() * 60 + local.getUTCMinutes();
    const currentBlock = dayBlocks.find(block => {
      const openMinutes = block.openH * 60 + block.openM;
      const closeMinutes = block.closeH * 60 + block.closeM;
      return localMinutes >= openMinutes && localMinutes <= closeMinutes - durationMinutes;
    });
    const nextBlock = dayBlocks.find(block => localMinutes < block.openH * 60 + block.openM);

    if (!currentBlock && nextBlock) {
      const openMinutes = nextBlock.openH * 60 + nextBlock.openM;
      cursor.setTime(cursor.getTime() + (openMinutes - localMinutes) * 60 * 1000);
      continue;
    }

    if (!currentBlock) {
      const nextDay = new Date(local.getTime() + 24 * 60 * 60 * 1000);
      nextDay.setUTCHours(0, 0, 0, 0);
      cursor.setTime(nextDay.getTime() - TZ_OFFSET_MS);
      continue;
    }

    const slotStart = cursor.getTime();
    const slotEnd = slotStart + durationMinutes * 60 * 1000;
    const isBusy = !ignoreBusy && busyPeriods.some(b => slotStart < b.end && slotEnd > b.start);

    if (!isBusy) slots.push({ label: formatSlotLabel(cursor), iso: cursor.toISOString() });
    cursor.setTime(cursor.getTime() + slotIntervalMinutes * 60 * 1000);
  }

  return slots;
}

export function formatSlotsForPrompt(slots: AvailableSlot[]): string {
  if (!slots.length) return '';
  return slots.map((s, i) => `${i + 1}. ${s.label} → ${s.iso}`).join('\n');
}

export interface SlotsForDayResult {
  slots: AvailableSlot[];
  usedDate: string;
  wasFallback: boolean;
  usedDateLabel: string;
}

export async function listSlotsForDay(
  targetDate: string,
  options: Omit<ListSlotsOptions, 'daysAhead' | 'maxSlots'> & { maxSlots?: number; maxFallbackDays?: number },
): Promise<SlotsForDayResult> {
  const {
    tenantId,
    calendarId = 'primary',
    durationMinutes = 60,
    slotIntervalMinutes = 60,
    maxSlots = 5,
    maxFallbackDays = 14,
    businessHours = DEFAULT_BUSINESS_HOURS,
    ignoreBusy = false,
  } = options;

  const calendar = await createCalendarClient(tenantId);
  const [year, month, day] = targetDate.split('-').map(Number);
  const dayStartUtc = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  const searchEnd = new Date(dayStartUtc.getTime() + (maxFallbackDays + 1) * 24 * 60 * 60 * 1000);
  const now = new Date();
  const searchStart = dayStartUtc > now ? dayStartUtc : now;

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: searchStart.toISOString(),
      timeMax: searchEnd.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busyPeriods = (data.calendars?.[calendarId]?.busy ?? []).map(b => ({
    start: new Date(b.start!).getTime(),
    end: new Date(b.end!).getTime(),
  }));

  let currentDayStart = new Date(searchStart);
  {
    const local = toLocal(currentDayStart);
    local.setUTCHours(0, 0, 0, 0);
    currentDayStart = new Date(local.getTime() - TZ_OFFSET_MS);
    if (currentDayStart < searchStart) currentDayStart = new Date(searchStart.getTime());
  }

  let daysChecked = 0;
  while (daysChecked <= maxFallbackDays) {
    const localDay = toLocal(currentDayStart);
    const dayBlocks = getBusinessHoursForDay(localDay, businessHours);

    if (dayBlocks.length) {
      const daySlots: AvailableSlot[] = [];

      for (const dayHours of dayBlocks) {
        const localMidnight = toLocal(currentDayStart);
        localMidnight.setUTCHours(dayHours.openH, dayHours.openM, 0, 0);
        const openUtc = new Date(localMidnight.getTime() - TZ_OFFSET_MS);

        let cursor = openUtc > searchStart ? openUtc : new Date(searchStart.getTime());
        const extra = cursor.getMinutes() % slotIntervalMinutes;
        if (extra !== 0) cursor.setMinutes(cursor.getMinutes() + (slotIntervalMinutes - extra), 0, 0);

        const closeMidnight = toLocal(currentDayStart);
        closeMidnight.setUTCHours(dayHours.closeH, dayHours.closeM, 0, 0);
        const closeLimit = closeMidnight.getTime() - TZ_OFFSET_MS - durationMinutes * 60 * 1000;

        while (cursor.getTime() <= closeLimit && daySlots.length < maxSlots) {
          const slotStart = cursor.getTime();
          const slotEnd = slotStart + durationMinutes * 60 * 1000;
          const isBusy = !ignoreBusy && busyPeriods.some(b => slotStart < b.end && slotEnd > b.start);
          if (!isBusy) daySlots.push({ label: formatSlotLabel(cursor), iso: cursor.toISOString() });
          cursor = new Date(cursor.getTime() + slotIntervalMinutes * 60 * 1000);
        }
      }

      if (daySlots.length > 0) {
        const usedLocal = toLocal(currentDayStart);
        const usedDateStr = `${String(usedLocal.getUTCFullYear())}-${String(usedLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(usedLocal.getUTCDate()).padStart(2, '0')}`;
        const usedDateLabel = `${DAYS_PT[usedLocal.getUTCDay()]}, ${String(usedLocal.getUTCDate()).padStart(2, '0')}/${String(usedLocal.getUTCMonth() + 1).padStart(2, '0')}`;
        return {
          slots: daySlots,
          usedDate: usedDateStr,
          wasFallback: usedDateStr !== targetDate,
          usedDateLabel,
        };
      }
    }

    const nextDayLocal = toLocal(currentDayStart);
    nextDayLocal.setUTCDate(nextDayLocal.getUTCDate() + 1);
    nextDayLocal.setUTCHours(0, 0, 0, 0);
    currentDayStart = new Date(nextDayLocal.getTime() - TZ_OFFSET_MS);
    daysChecked++;
  }

  const usedLocal = toLocal(new Date(dayStartUtc));
  const usedDateLabel = `${DAYS_PT[usedLocal.getUTCDay()]}, ${String(usedLocal.getUTCDate()).padStart(2, '0')}/${String(usedLocal.getUTCMonth() + 1).padStart(2, '0')}`;
  return { slots: [], usedDate: targetDate, wasFallback: false, usedDateLabel };
}

export async function checkSlotAvailability(
  startTime: string,
  durationMinutes: number,
  calendarId = 'primary',
  tenantId?: string,
): Promise<boolean> {
  const calendar = await createCalendarClient(tenantId);
  const endTime = new Date(
    new Date(startTime).getTime() + durationMinutes * 60 * 1000,
  ).toISOString();

  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: startTime,
      timeMax: endTime,
      items: [{ id: calendarId }],
    },
  });

  return (data.calendars?.[calendarId]?.busy ?? []).length === 0;
}

export async function createEvent(params: {
  tenantId?: string;
  customerId: string;
  serviceType: string;
  scheduledAt: string;
  durationMinutes?: number;
  calendarId?: string;
  professionalName?: string;
  customerName?: string;
}): Promise<{ id: string }> {
  const calendar = await createCalendarClient(params.tenantId);
  const duration = params.durationMinutes ?? 60;
  const endTime = new Date(
    new Date(params.scheduledAt).getTime() + duration * 60 * 1000,
  ).toISOString();
  const eventSummary = [params.serviceType, params.professionalName, params.customerName]
    .filter(Boolean)
    .join(' - ');

  const { data } = await calendar.events.insert({
    calendarId: params.calendarId ?? 'primary',
    requestBody: {
      summary: `${params.serviceType}${params.professionalName ? ` — ${params.professionalName}` : ''}`,
      start: { dateTime: params.scheduledAt },
      end: { dateTime: endTime },
      extendedProperties: { private: { customerId: params.customerId } },
      ...(eventSummary ? { summary: eventSummary } : {}),
    },
  });

  return { id: data.id! };
}

export async function deleteEvent(
  eventId: string,
  calendarId = 'primary',
  tenantId?: string,
): Promise<void> {
  const calendar = await createCalendarClient(tenantId);
  await calendar.events.delete({ calendarId, eventId });
}
