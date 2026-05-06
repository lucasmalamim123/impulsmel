-- Operational metrics, integration health, prompt governance, and content approval.

CREATE TABLE IF NOT EXISTS message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('sent', 'received')),
  message_type TEXT NOT NULL DEFAULT 'text',
  channel TEXT NOT NULL,
  external_event_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS message_events_external_unique
  ON message_events (tenant_id, channel, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS message_events_tenant_created_idx
  ON message_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS message_events_tenant_direction_type_idx
  ON message_events (tenant_id, direction, message_type, created_at DESC);

CREATE TABLE IF NOT EXISTS integration_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('connected', 'disconnected', 'error', 'pending', 'unknown')),
  last_error TEXT,
  last_error_at TIMESTAMPTZ,
  last_connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  auto_retry BOOLEAN DEFAULT false,
  retry_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, integration)
);

CREATE INDEX IF NOT EXISTS integration_status_tenant_status_idx
  ON integration_status (tenant_id, status, integration);

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS module TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS integration TEXT,
  ADD COLUMN IF NOT EXISTS phone_normalized TEXT,
  ADD COLUMN IF NOT EXISTS request_ip TEXT,
  ADD COLUMN IF NOT EXISTS related_entity_id UUID;

CREATE INDEX IF NOT EXISTS audit_log_filters_idx
  ON audit_log (tenant_id, module, channel, integration, status, created_at DESC);

ALTER TABLE dead_letter_queue
  ADD COLUMN IF NOT EXISTS integration TEXT,
  ADD COLUMN IF NOT EXISTS technical_details JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_retry BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS dlq_integration_status_idx
  ON dead_letter_queue (tenant_id, integration, status, created_at DESC);

CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  fields JSONB NOT NULL DEFAULT '{}',
  author_id UUID,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_versions_one_published
  ON prompt_versions (tenant_id)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'geral',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_approval', 'published', 'rejected')),
  submitted_by UUID,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejected_reason TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS knowledge_documents_tenant_status_idx
  ON knowledge_documents (tenant_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  status TEXT NOT NULL,
  author_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (document_id, version)
);
