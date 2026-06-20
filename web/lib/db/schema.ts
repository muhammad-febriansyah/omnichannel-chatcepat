import { pgTable, varchar, unique, uuid, text, jsonb, timestamp, foreignKey, index, uniqueIndex, integer, bigint, boolean, vector, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const broadcastRecipientStatus = pgEnum("broadcast_recipient_status", ['pending', 'sent', 'delivered', 'failed', 'skipped_optout'])
export const broadcastStatus = pgEnum("broadcast_status", ['draft', 'scheduled', 'running', 'done', 'failed'])
export const channelStatus = pgEnum("channel_status", ['connected', 'disconnected', 'pending', 'banned'])
export const channelType = pgEnum("channel_type", ['wa_official', 'wa_unofficial', 'instagram', 'facebook', 'telegram'])
export const conversationHandler = pgEnum("conversation_handler", ['bot', 'agent', 'idle'])
export const conversationStatus = pgEnum("conversation_status", ['open', 'pending', 'resolved', 'snoozed'])
export const flowStatus = pgEnum("flow_status", ['draft', 'active'])
export const flowTrigger = pgEnum("flow_trigger", ['keyword', 'welcome', 'fallback'])
export const knowledgeSourceType = pgEnum("knowledge_source_type", ['file', 'url', 'faq', 'manual'])
export const knowledgeStatus = pgEnum("knowledge_status", ['processing', 'ready'])
export const messageDirection = pgEnum("message_direction", ['inbound', 'outbound'])
export const messageSender = pgEnum("message_sender", ['contact', 'bot', 'agent', 'system'])
export const messageStatus = pgEnum("message_status", ['queued', 'sent', 'delivered', 'read', 'failed'])
export const messageType = pgEnum("message_type", ['text', 'image', 'file', 'template', 'interactive'])
export const orderStatus = pgEnum("order_status", ['pending', 'paid', 'failed', 'expired'])
export const optInSource = pgEnum("opt_in_source", ['import', 'form', 'click_to_chat', 'qr', 'inbound'])
export const optInStatus = pgEnum("opt_in_status", ['opted_in', 'opted_out', 'unknown'])
export const templateKind = pgEnum("template_kind", ['hsm', 'quick_reply'])
export const templateStatus = pgEnum("template_status", ['draft', 'approved', 'rejected'])
export const tenantPlan = pgEnum("tenant_plan", ['pro', 'business', 'enterprise'])
export const tenantStatus = pgEnum("tenant_status", ['active', 'suspended'])
export const userRole = pgEnum("user_role", ['admin', 'client'])
export const userStatus = pgEnum("user_status", ['active', 'invited', 'disabled'])


export const alembicVersion = pgTable("alembic_version", {
	versionNum: varchar("version_num", { length: 32 }).primaryKey().notNull(),
});

export const tenants = pgTable("tenants", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	plan: tenantPlan().default('pro').notNull(),
	status: tenantStatus().default('active').notNull(),
	settings: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("tenants_slug_key").on(table.slug),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id"),
	name: text().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	role: userRole().notNull(),
	status: userStatus().default('invited').notNull(),
	avatarUrl: text("avatar_url"),
	lastActiveAt: timestamp("last_active_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "users_tenant_id_fkey"
		}).onDelete("cascade"),
	unique("users_email_key").on(table.email),
]);

export const channels = pgTable("channels", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	type: channelType().notNull(),
	name: text().notNull(),
	status: channelStatus().default('pending').notNull(),
	credentials: jsonb().default({}).notNull(),
	externalId: text("external_id"),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_channel_lookup").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.type.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "channels_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const contacts = pgTable("contacts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	phone: text(),
	externalId: text("external_id"),
	name: text(),
	optInStatus: optInStatus("opt_in_status").default('unknown').notNull(),
	optInSource: optInSource("opt_in_source"),
	optInAt: timestamp("opt_in_at", { withTimezone: true, mode: 'string' }),
	tags: text().array().default([""]).notNull(),
	attributes: jsonb().default({}).notNull(),
	lastContactedAt: timestamp("last_contacted_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_contact_attrs").using("gin", table.attributes.asc().nullsLast().op("jsonb_ops")),
	index("idx_contact_optin").using("btree", table.tenantId.asc().nullsLast().op("enum_ops"), table.optInStatus.asc().nullsLast().op("enum_ops")),
	index("idx_contact_tags").using("gin", table.tags.asc().nullsLast().op("array_ops")),
	uniqueIndex("uq_contact_phone").using("btree", table.tenantId.asc().nullsLast().op("text_ops"), table.phone.asc().nullsLast().op("uuid_ops")).where(sql`(phone IS NOT NULL)`),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "contacts_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const flows = pgTable("flows", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	status: flowStatus().default('draft').notNull(),
	trigger: flowTrigger().notNull(),
	definition: jsonb().default({}).notNull(),
	version: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "flows_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const conversations = pgTable("conversations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	channelId: uuid("channel_id").notNull(),
	contactId: uuid("contact_id").notNull(),
	status: conversationStatus().default('open').notNull(),
	handler: conversationHandler().default('bot').notNull(),
	assignedAgentId: uuid("assigned_agent_id"),
	lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: 'string' }),
	lastMessagePreview: text("last_message_preview"),
	unreadCount: integer("unread_count").default(0).notNull(),
	serviceWindowExpiresAt: timestamp("service_window_expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_conv_assigned").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.assignedAgentId.asc().nullsLast().op("uuid_ops"), table.lastMessageAt.desc().nullsFirst().op("timestamptz_ops")),
	index("idx_conv_channel").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.channelId.asc().nullsLast().op("uuid_ops")),
	index("idx_conv_inbox").using("btree", table.tenantId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("timestamptz_ops"), table.lastMessageAt.desc().nullsFirst().op("enum_ops")),
	uniqueIndex("uq_conv_open").using("btree", table.channelId.asc().nullsLast().op("uuid_ops"), table.contactId.asc().nullsLast().op("uuid_ops")).where(sql`(status <> 'resolved'::conversation_status)`),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "conversations_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "conversations_channel_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "conversations_contact_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.assignedAgentId],
			foreignColumns: [users.id],
			name: "conversations_assigned_agent_id_fkey"
		}).onDelete("set null"),
]);

export const messages = pgTable("messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	conversationId: uuid("conversation_id").notNull(),
	channelId: uuid("channel_id").notNull(),
	direction: messageDirection().notNull(),
	sender: messageSender().notNull(),
	agentId: uuid("agent_id"),
	type: messageType().default('text').notNull(),
	body: text(),
	media: jsonb(),
	providerMessageId: text("provider_message_id"),
	status: messageStatus().default('queued').notNull(),
	idempotencyKey: text("idempotency_key"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_msg_status").using("btree", table.tenantId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("uuid_ops")).where(sql`(status = ANY (ARRAY['queued'::message_status, 'failed'::message_status]))`),
	index("idx_msg_thread").using("btree", table.conversationId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("uuid_ops")),
	uniqueIndex("uq_msg_provider").using("btree", table.channelId.asc().nullsLast().op("uuid_ops"), table.providerMessageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "messages_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "messages_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "messages_channel_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.agentId],
			foreignColumns: [users.id],
			name: "messages_agent_id_fkey"
		}).onDelete("set null"),
]);

export const conversationStates = pgTable("conversation_states", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	conversationId: uuid("conversation_id").notNull(),
	flowId: uuid("flow_id"),
	currentNodeId: text("current_node_id"),
	context: jsonb().default({}).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_state_conv").using("btree", table.conversationId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "conversation_states_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversations.id],
			name: "conversation_states_conversation_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.flowId],
			foreignColumns: [flows.id],
			name: "conversation_states_flow_id_fkey"
		}).onDelete("set null"),
]);

export const knowledgeDocuments = pgTable("knowledge_documents", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	sourceType: knowledgeSourceType("source_type").notNull(),
	title: text().notNull(),
	status: knowledgeStatus().default('processing').notNull(),
	meta: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "knowledge_documents_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const knowledgeChunks = pgTable("knowledge_chunks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	documentId: uuid("document_id").notNull(),
	content: text().notNull(),
	embedding: vector({ dimensions: 1536 }),
	tokenCount: integer("token_count"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_kchunk_tenant").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.documentId.asc().nullsLast().op("uuid_ops")),
	index("idx_kchunk_vec").using("ivfflat", table.embedding.asc().nullsLast().op("vector_cosine_ops")).with({lists: "100"}),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "knowledge_chunks_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [knowledgeDocuments.id],
			name: "knowledge_chunks_document_id_fkey"
		}).onDelete("cascade"),
]);

export const broadcasts = pgTable("broadcasts", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	channelId: uuid("channel_id").notNull(),
	name: text().notNull(),
	templateId: text("template_id"),
	bodySnapshot: text("body_snapshot"),
	status: broadcastStatus().default('draft').notNull(),
	scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: 'string' }),
	audienceFilter: jsonb("audience_filter").default({}).notNull(),
	stats: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_bcast_sched").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops"), table.scheduledAt.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "broadcasts_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.channelId],
			foreignColumns: [channels.id],
			name: "broadcasts_channel_id_fkey"
		}).onDelete("cascade"),
]);

export const broadcastRecipients = pgTable("broadcast_recipients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	broadcastId: uuid("broadcast_id").notNull(),
	contactId: uuid("contact_id").notNull(),
	status: broadcastRecipientStatus().default('pending').notNull(),
	messageId: uuid("message_id"),
	error: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_bcast_recip").using("btree", table.broadcastId.asc().nullsLast().op("uuid_ops"), table.status.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "broadcast_recipients_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.broadcastId],
			foreignColumns: [broadcasts.id],
			name: "broadcast_recipients_broadcast_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contactId],
			foreignColumns: [contacts.id],
			name: "broadcast_recipients_contact_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [messages.id],
			name: "broadcast_recipients_message_id_fkey"
		}).onDelete("set null"),
]);

export const tags = pgTable("tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	color: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "tags_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const templates = pgTable("templates", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	name: text().notNull(),
	kind: templateKind().default('quick_reply').notNull(),
	category: text(),
	language: text(),
	body: text().notNull(),
	status: templateStatus().default('draft').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_template_lookup").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.kind.asc().nullsLast().op("enum_ops")),
	uniqueIndex("uq_template_name").using("btree", table.tenantId.asc().nullsLast().op("uuid_ops"), table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "templates_tenant_id_fkey"
		}).onDelete("cascade"),
]);

export const auditLogs = pgTable("audit_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	actorId: uuid("actor_id"),
	action: text().notNull(),
	entity: text().notNull(),
	entityId: text("entity_id"),
	diff: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_audit").using("btree", table.tenantId.asc().nullsLast().op("timestamptz_ops"), table.createdAt.desc().nullsFirst().op("timestamptz_ops")),
	foreignKey({
			columns: [table.tenantId],
			foreignColumns: [tenants.id],
			name: "audit_logs_tenant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [users.id],
			name: "audit_logs_actor_id_fkey"
		}).onDelete("set null"),
]);

export const plans = pgTable("plans", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tier: tenantPlan().default('pro').notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	priceIdr: bigint("price_idr", { mode: 'number' }).default(0).notNull(),
	period: text().default('month').notNull(),
	quota: integer(),
	description: text(),
	features: jsonb().$type<string[]>().default([]).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	highlight: boolean().default(false).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_plan_slug").on(table.slug),
	index("idx_plan_active").on(table.isActive, table.sortOrder),
]);

export const orders = pgTable("orders", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	tenantId: uuid("tenant_id").notNull(),
	planId: uuid("plan_id"),
	planName: text("plan_name").notNull(),
	tier: tenantPlan().notNull(),
	amountIdr: bigint("amount_idr", { mode: 'number' }).notNull(),
	merchantOrderId: text("merchant_order_id").notNull(),
	status: orderStatus().default('pending').notNull(),
	duitkuReference: text("duitku_reference"),
	paymentUrl: text("payment_url"),
	paymentMethod: text("payment_method"),
	customerName: text("customer_name"),
	customerEmail: text("customer_email"),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	raw: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_order_merchant_order_id").on(table.merchantOrderId),
	index("idx_order_tenant").on(table.tenantId, table.createdAt),
	foreignKey({
		columns: [table.tenantId],
		foreignColumns: [tenants.id],
		name: "orders_tenant_id_fkey"
	}).onDelete("cascade"),
	foreignKey({
		columns: [table.planId],
		foreignColumns: [plans.id],
		name: "orders_plan_id_fkey"
	}).onDelete("set null"),
]);
