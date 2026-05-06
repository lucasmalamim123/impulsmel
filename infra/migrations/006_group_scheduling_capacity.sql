-- Group scheduling capacity per professional.

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS slot_capacity INT DEFAULT 1;

UPDATE professionals
SET slot_capacity = 1
WHERE slot_capacity IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'professionals_slot_capacity_positive'
  ) THEN
    ALTER TABLE professionals
      ADD CONSTRAINT professionals_slot_capacity_positive CHECK (slot_capacity >= 1);
  END IF;
END $$;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS scheduling_mode TEXT DEFAULT 'individual';

UPDATE services
SET scheduling_mode = 'individual'
WHERE scheduling_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_scheduling_mode_check'
  ) THEN
    ALTER TABLE services
      ADD CONSTRAINT services_scheduling_mode_check CHECK (scheduling_mode IN ('individual', 'group'));
  END IF;
END $$;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id),
  ADD COLUMN IF NOT EXISTS professional_name TEXT;

CREATE INDEX IF NOT EXISTS appointments_capacity_lookup_idx
  ON appointments (tenant_id, professional_id, service_type, scheduled_at, status);
