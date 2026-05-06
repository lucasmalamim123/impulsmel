-- Capacity and scheduling mode by professional-service link.

CREATE TABLE IF NOT EXISTS professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  scheduling_mode TEXT NOT NULL DEFAULT 'individual'
    CHECK (scheduling_mode IN ('individual', 'group')),
  slot_capacity INT NOT NULL DEFAULT 1 CHECK (slot_capacity >= 1),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (professional_id, service_id)
);

CREATE INDEX IF NOT EXISTS professional_services_tenant_professional_idx
  ON professional_services (tenant_id, professional_id, active);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);

CREATE INDEX IF NOT EXISTS appointments_capacity_service_lookup_idx
  ON appointments (tenant_id, professional_id, service_id, scheduled_at, status);

INSERT INTO professional_services (
  tenant_id,
  professional_id,
  service_id,
  scheduling_mode,
  slot_capacity
)
SELECT
  p.tenant_id,
  p.id,
  s.id,
  COALESCE(s.scheduling_mode, 'individual'),
  CASE
    WHEN COALESCE(s.scheduling_mode, 'individual') = 'group'
      THEN GREATEST(COALESCE(p.slot_capacity, 1), 1)
    ELSE 1
  END
FROM professionals p
JOIN services s ON s.tenant_id = p.tenant_id
WHERE p.active = true
  AND s.active = true
  AND EXISTS (
    SELECT 1
    FROM unnest(p.specialties) specialty
    WHERE lower(trim(specialty)) = lower(trim(s.name))
       OR lower(trim(specialty)) LIKE '%' || lower(trim(s.name)) || '%'
       OR lower(trim(s.name)) LIKE '%' || lower(trim(specialty)) || '%'
  )
ON CONFLICT (professional_id, service_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
