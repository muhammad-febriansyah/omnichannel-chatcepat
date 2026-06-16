-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TYPE "public"."broadcast_recipient_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'skipped_optout');--> statement-breakpoint
CREATE TYPE "public"."broadcast_status" AS ENUM('draft', 'scheduled', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('connected', 'disconnected', 'pending', 'banned');--> statement-breakpoint
CREATE TYPE "public"."channel_type" AS ENUM('wa_official', 'wa_unofficial', 'instagram', 'facebook', 'telegram');--> statement-breakpoint
CREATE TYPE "public"."conversation_handler" AS ENUM('bot', 'agent', 'idle');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('open', 'pending', 'resolved', 'snoozed');--> statement-breakpoint
CREATE TYPE "public"."flow_status" AS ENUM('draft', 'active');--> statement-breakpoint
CREATE TYPE "public"."flow_trigger" AS ENUM('keyword', 'welcome', 'fallback');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('file', 'url', 'faq', 'manual');--> statement-breakpoint
CREATE TYPE "public"."knowledge_status" AS ENUM('processing', 'ready');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_sender" AS ENUM('contact', 'bot', 'agent', 'system');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'file', 'template', 'interactive');--> statement-breakpoint
CREATE TYPE "public"."opt_in_source" AS ENUM('import', 'form', 'click_to_chat', 'qr', 'inbound');--> statement-breakpoint
CREATE TYPE "public"."opt_in_status" AS ENUM('opted_in', 'opted_out', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."tenant_plan" AS ENUM('pro', 'business', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'supervisor', 'agent');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'invited', 'disabled');--> statement-breakpoint
CREATE TABLE "alembic_version" (
	"version_num" varchar(32) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" "tenant_plan" DEFAULT 'pro' NOT NULL,
	"status" "tenant_status" DEFAULT 'active' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" "channel_type" NOT NULL,
	"name" text NOT NULL,
	"status" "channel_status" DEFAULT 'pending' NOT NULL,
	"credentials" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"external_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text,
	"external_id" text,
	"name" text,
	"opt_in_status" "opt_in_status" DEFAULT 'unknown' NOT NULL,
	"opt_in_source" "opt_in_source",
	"opt_in_at" timestamp with time zone,
	"tags" text[] DEFAULT '{""}' NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_contacted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "flow_status" DEFAULT 'draft' NOT NULL,
	"trigger" "flow_trigger" NOT NULL,
	"definition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "conversation_status" DEFAULT 'open' NOT NULL,
	"handler" "conversation_handler" DEFAULT 'bot' NOT NULL,
	"assigned_agent_id" uuid,
	"last_message_at" timestamp with time zone,
	"last_message_preview" text,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"service_window_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"sender" "message_sender" NOT NULL,
	"agent_id" uuid,
	"type" "message_type" DEFAULT 'text' NOT NULL,
	"body" text,
	"media" jsonb,
	"provider_message_id" text,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"flow_id" uuid,
	"current_node_id" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_type" "knowledge_source_type" NOT NULL,
	"title" text NOT NULL,
	"status" "knowledge_status" DEFAULT 'processing' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"body_snapshot" text,
	"status" "broadcast_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"audience_filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcast_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"broadcast_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "broadcast_recipient_status" DEFAULT 'pending' NOT NULL,
	"message_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_agent_id_fkey" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_states" ADD CONSTRAINT "conversation_states_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_channel_lookup" ON "channels" USING btree ("tenant_id" uuid_ops,"type" enum_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_contact_attrs" ON "contacts" USING gin ("attributes" jsonb_ops);--> statement-breakpoint
CREATE INDEX "idx_contact_optin" ON "contacts" USING btree ("tenant_id" enum_ops,"opt_in_status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_contact_tags" ON "contacts" USING gin ("tags" array_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_contact_phone" ON "contacts" USING btree ("tenant_id" text_ops,"phone" uuid_ops) WHERE (phone IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_conv_assigned" ON "conversations" USING btree ("tenant_id" timestamptz_ops,"assigned_agent_id" uuid_ops,"last_message_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_conv_channel" ON "conversations" USING btree ("tenant_id" uuid_ops,"channel_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_conv_inbox" ON "conversations" USING btree ("tenant_id" enum_ops,"status" timestamptz_ops,"last_message_at" enum_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_conv_open" ON "conversations" USING btree ("channel_id" uuid_ops,"contact_id" uuid_ops) WHERE (status <> 'resolved'::conversation_status);--> statement-breakpoint
CREATE INDEX "idx_msg_status" ON "messages" USING btree ("tenant_id" enum_ops,"status" uuid_ops) WHERE (status = ANY (ARRAY['queued'::message_status, 'failed'::message_status]));--> statement-breakpoint
CREATE INDEX "idx_msg_thread" ON "messages" USING btree ("conversation_id" timestamptz_ops,"created_at" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_msg_provider" ON "messages" USING btree ("channel_id" uuid_ops,"provider_message_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_state_conv" ON "conversation_states" USING btree ("conversation_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_kchunk_tenant" ON "knowledge_chunks" USING btree ("tenant_id" uuid_ops,"document_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_kchunk_vec" ON "knowledge_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100);--> statement-breakpoint
CREATE INDEX "idx_bcast_sched" ON "broadcasts" USING btree ("tenant_id" uuid_ops,"status" uuid_ops,"scheduled_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_bcast_recip" ON "broadcast_recipients" USING btree ("broadcast_id" uuid_ops,"status" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_audit" ON "audit_logs" USING btree ("tenant_id" timestamptz_ops,"created_at" timestamptz_ops);
*/