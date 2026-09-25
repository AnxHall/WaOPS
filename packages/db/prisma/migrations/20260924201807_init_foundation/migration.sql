-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "trial_ends_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "name" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata_json" JSONB,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_entitlements" (
    "plan_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("plan_id","module_id","feature_key")
);

-- CreateTable
CREATE TABLE "tenant_entitlements" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "feature_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit_value" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'plan',
    "starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "plan_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "grace_until" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "tenant_id" UUID NOT NULL,
    "metric_key" TEXT NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("tenant_id","metric_key","period_start")
);

-- CreateTable
CREATE TABLE "hosts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "os_type" TEXT,
    "os_version" TEXT,
    "arch" TEXT,
    "environment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hosts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host_id" UUID,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "protocol_version" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_seen_at" TIMESTAMPTZ(6),
    "credential_version" INTEGER NOT NULL DEFAULT 1,
    "credential_hash" TEXT,
    "capabilities" TEXT[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_interfaces" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mac" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata_json" JSONB,

    CONSTRAINT "network_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "filesystems" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "mount" TEXT NOT NULL,
    "device" TEXT,
    "fs_type" TEXT,
    "metadata_json" JSONB,

    CONSTRAINT "filesystems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "containers" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "host_id" UUID NOT NULL,
    "runtime_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "state" TEXT NOT NULL,
    "health" TEXT,
    "metadata_json" JSONB,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "containers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "service_type" TEXT,
    "environment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_dependencies" (
    "tenant_id" UUID NOT NULL,
    "source_service_id" UUID NOT NULL,
    "target_resource_id" UUID NOT NULL,
    "dependency_type" TEXT NOT NULL,

    CONSTRAINT "service_dependencies_pkey" PRIMARY KEY ("source_service_id","target_resource_id","dependency_type")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "resource_id" UUID,
    "severity" TEXT NOT NULL,
    "fingerprint" TEXT,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributes_json" JSONB,
    "correlation_id" UUID,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'detected',
    "primary_resource_id" UUID,
    "fingerprint" TEXT,
    "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_events" (
    "incident_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,

    CONSTRAINT "incident_events_pkey" PRIMARY KEY ("incident_id","event_id")
);

-- CreateTable
CREATE TABLE "incident_timeline" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "entry_type" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "payload_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID,
    "monitor_id" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "condition_json" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_inbox" (
    "dedup_key" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_inbox_pkey" PRIMARY KEY ("dedup_key")
);

-- CreateTable
CREATE TABLE "metric_samples" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions_json" JSONB,
    "observed_at" TIMESTAMPTZ(6) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config_json" JSONB NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "channel_id" UUID NOT NULL,
    "incident_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "provider_message_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "memberships_tenant_id_idx" ON "memberships"("tenant_id");

-- CreateIndex
CREATE INDEX "memberships_user_id_idx" ON "memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tenant_id_user_id_organization_id_key" ON "memberships"("tenant_id", "user_id", "organization_id");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "modules_key_key" ON "modules"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE INDEX "tenant_entitlements_tenant_id_idx" ON "tenant_entitlements"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_entitlements_tenant_id_module_id_feature_key_key" ON "tenant_entitlements"("tenant_id", "module_id", "feature_key");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "hosts_tenant_id_status_idx" ON "hosts"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "hosts_tenant_id_name_key" ON "hosts"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "agents_tenant_id_status_idx" ON "agents"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "network_interfaces_tenant_id_host_id_name_key" ON "network_interfaces"("tenant_id", "host_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "filesystems_tenant_id_host_id_mount_key" ON "filesystems"("tenant_id", "host_id", "mount");

-- CreateIndex
CREATE INDEX "containers_tenant_id_state_idx" ON "containers"("tenant_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "containers_tenant_id_host_id_runtime_id_key" ON "containers"("tenant_id", "host_id", "runtime_id");

-- CreateIndex
CREATE UNIQUE INDEX "services_tenant_id_name_key" ON "services"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "service_dependencies_tenant_id_idx" ON "service_dependencies"("tenant_id");

-- CreateIndex
CREATE INDEX "events_tenant_id_observed_at_idx" ON "events"("tenant_id", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "events_tenant_id_fingerprint_idx" ON "events"("tenant_id", "fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "events_id_tenant_id_key" ON "events"("id", "tenant_id");

-- CreateIndex
CREATE INDEX "incidents_tenant_id_status_idx" ON "incidents"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "incidents_tenant_id_detected_at_idx" ON "incidents"("tenant_id", "detected_at" DESC);

-- CreateIndex
CREATE INDEX "incident_events_tenant_id_idx" ON "incident_events"("tenant_id");

-- CreateIndex
CREATE INDEX "incident_timeline_tenant_id_incident_id_created_at_idx" ON "incident_timeline"("tenant_id", "incident_id", "created_at");

-- CreateIndex
CREATE INDEX "alert_rules_tenant_id_enabled_idx" ON "alert_rules"("tenant_id", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_id_key" ON "outbox_events"("event_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- CreateIndex
CREATE INDEX "event_inbox_tenant_id_idx" ON "event_inbox"("tenant_id");

-- CreateIndex
CREATE INDEX "metric_samples_tenant_id_resource_id_metric_observed_at_idx" ON "metric_samples"("tenant_id", "resource_id", "metric", "observed_at" DESC);

-- CreateIndex
CREATE INDEX "metric_samples_observed_at_idx" ON "metric_samples"("observed_at");

-- CreateIndex
CREATE INDEX "notification_channels_tenant_id_idx" ON "notification_channels"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_channels_tenant_id_name_key" ON "notification_channels"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "notification_deliveries_tenant_id_status_idx" ON "notification_deliveries"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_entitlements" ADD CONSTRAINT "tenant_entitlements_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosts" ADD CONSTRAINT "hosts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_interfaces" ADD CONSTRAINT "network_interfaces_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "filesystems" ADD CONSTRAINT "filesystems_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "containers" ADD CONSTRAINT "containers_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "hosts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_dependencies" ADD CONSTRAINT "service_dependencies_source_service_id_fkey" FOREIGN KEY ("source_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_timeline" ADD CONSTRAINT "incident_timeline_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_samples" ADD CONSTRAINT "metric_samples_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "notification_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
