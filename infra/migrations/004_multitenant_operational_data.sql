-- Multitenancy hardening for operational data.
-- Existing rows are assigned to the first active tenant so the migration can run on current installs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenants LIMIT 1) THEN
    INSERT INTO tenants (name, slug, plan, active)
    VALUES ('Default Tenant', 'default', 'basic', true);
  END IF;
END $$;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE dead_letter_queue ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

WITH default_tenant AS (
  SELECT id FROM tenants WHERE active = true ORDER BY created_at ASC LIMIT 1
)
UPDATE customers SET tenant_id = (SELECT id FROM default_tenant) WHERE tenant_id IS NULL;

UPDATE conversations c
SET tenant_id = COALESCE(c.tenant_id, cu.tenant_id)
FROM customers cu
WHERE c.customer_id = cu.id AND c.tenant_id IS NULL;

UPDATE appointments a
SET tenant_id = COALESCE(a.tenant_id, cu.tenant_id)
FROM customers cu
WHERE a.customer_id = cu.id AND a.tenant_id IS NULL;

UPDATE payments p
SET tenant_id = COALESCE(p.tenant_id, cu.tenant_id)
FROM customers cu
WHERE p.customer_id = cu.id AND p.tenant_id IS NULL;

WITH default_tenant AS (
  SELECT id FROM tenants WHERE active = true ORDER BY created_at ASC LIMIT 1
)
UPDATE audit_log SET tenant_id = (SELECT id FROM default_tenant) WHERE tenant_id IS NULL;

WITH default_tenant AS (
  SELECT id FROM tenants WHERE active = true ORDER BY created_at ASC LIMIT 1
)
UPDATE dead_letter_queue SET tenant_id = (SELECT id FROM default_tenant) WHERE tenant_id IS NULL;

WITH default_tenant AS (
  SELECT id FROM tenants WHERE active = true ORDER BY created_at ASC LIMIT 1
)
UPDATE incidents SET tenant_id = (SELECT id FROM default_tenant) WHERE tenant_id IS NULL;

ALTER TABLE customers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE appointments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE payments ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_normalized_key;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_idempotency_key_key;
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_idempotency_key_key;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_idempotency_key_key;

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_phone_unique
  ON customers (tenant_id, phone_normalized);

CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_idempotency_unique
  ON messages (conversation_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_tenant_idempotency_unique
  ON appointments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_idempotency_unique
  ON payments (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS conversations_tenant_customer_channel_idx
  ON conversations (tenant_id, customer_id, channel, status);

CREATE INDEX IF NOT EXISTS appointments_tenant_customer_scheduled_idx
  ON appointments (tenant_id, customer_id, scheduled_at);

CREATE INDEX IF NOT EXISTS payments_tenant_asaas_idx
  ON payments (tenant_id, asaas_charge_id);

CREATE INDEX IF NOT EXISTS audit_log_tenant_created_idx
  ON audit_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dlq_tenant_status_idx
  ON dead_letter_queue (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_tenant_created_idx
  ON incidents (tenant_id, created_at DESC);
