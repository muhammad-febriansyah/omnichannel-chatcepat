import { relations } from "drizzle-orm/relations";
import { tenants, users, channels, contacts, flows, conversations, messages, conversationStates, knowledgeDocuments, knowledgeChunks, broadcasts, broadcastRecipients, tags, auditLogs } from "./schema";

export const usersRelations = relations(users, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [users.tenantId],
		references: [tenants.id]
	}),
	conversations: many(conversations),
	messages: many(messages),
	auditLogs: many(auditLogs),
}));

export const tenantsRelations = relations(tenants, ({many}) => ({
	users: many(users),
	channels: many(channels),
	contacts: many(contacts),
	flows: many(flows),
	conversations: many(conversations),
	messages: many(messages),
	conversationStates: many(conversationStates),
	knowledgeDocuments: many(knowledgeDocuments),
	knowledgeChunks: many(knowledgeChunks),
	broadcasts: many(broadcasts),
	broadcastRecipients: many(broadcastRecipients),
	tags: many(tags),
	auditLogs: many(auditLogs),
}));

export const channelsRelations = relations(channels, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [channels.tenantId],
		references: [tenants.id]
	}),
	conversations: many(conversations),
	messages: many(messages),
	broadcasts: many(broadcasts),
}));

export const contactsRelations = relations(contacts, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [contacts.tenantId],
		references: [tenants.id]
	}),
	conversations: many(conversations),
	broadcastRecipients: many(broadcastRecipients),
}));

export const flowsRelations = relations(flows, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [flows.tenantId],
		references: [tenants.id]
	}),
	conversationStates: many(conversationStates),
}));

export const conversationsRelations = relations(conversations, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [conversations.tenantId],
		references: [tenants.id]
	}),
	channel: one(channels, {
		fields: [conversations.channelId],
		references: [channels.id]
	}),
	contact: one(contacts, {
		fields: [conversations.contactId],
		references: [contacts.id]
	}),
	user: one(users, {
		fields: [conversations.assignedAgentId],
		references: [users.id]
	}),
	messages: many(messages),
	conversationStates: many(conversationStates),
}));

export const messagesRelations = relations(messages, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [messages.tenantId],
		references: [tenants.id]
	}),
	conversation: one(conversations, {
		fields: [messages.conversationId],
		references: [conversations.id]
	}),
	channel: one(channels, {
		fields: [messages.channelId],
		references: [channels.id]
	}),
	user: one(users, {
		fields: [messages.agentId],
		references: [users.id]
	}),
	broadcastRecipients: many(broadcastRecipients),
}));

export const conversationStatesRelations = relations(conversationStates, ({one}) => ({
	tenant: one(tenants, {
		fields: [conversationStates.tenantId],
		references: [tenants.id]
	}),
	conversation: one(conversations, {
		fields: [conversationStates.conversationId],
		references: [conversations.id]
	}),
	flow: one(flows, {
		fields: [conversationStates.flowId],
		references: [flows.id]
	}),
}));

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [knowledgeDocuments.tenantId],
		references: [tenants.id]
	}),
	knowledgeChunks: many(knowledgeChunks),
}));

export const knowledgeChunksRelations = relations(knowledgeChunks, ({one}) => ({
	tenant: one(tenants, {
		fields: [knowledgeChunks.tenantId],
		references: [tenants.id]
	}),
	knowledgeDocument: one(knowledgeDocuments, {
		fields: [knowledgeChunks.documentId],
		references: [knowledgeDocuments.id]
	}),
}));

export const broadcastsRelations = relations(broadcasts, ({one, many}) => ({
	tenant: one(tenants, {
		fields: [broadcasts.tenantId],
		references: [tenants.id]
	}),
	channel: one(channels, {
		fields: [broadcasts.channelId],
		references: [channels.id]
	}),
	broadcastRecipients: many(broadcastRecipients),
}));

export const broadcastRecipientsRelations = relations(broadcastRecipients, ({one}) => ({
	tenant: one(tenants, {
		fields: [broadcastRecipients.tenantId],
		references: [tenants.id]
	}),
	broadcast: one(broadcasts, {
		fields: [broadcastRecipients.broadcastId],
		references: [broadcasts.id]
	}),
	contact: one(contacts, {
		fields: [broadcastRecipients.contactId],
		references: [contacts.id]
	}),
	message: one(messages, {
		fields: [broadcastRecipients.messageId],
		references: [messages.id]
	}),
}));

export const tagsRelations = relations(tags, ({one}) => ({
	tenant: one(tenants, {
		fields: [tags.tenantId],
		references: [tenants.id]
	}),
}));

export const auditLogsRelations = relations(auditLogs, ({one}) => ({
	tenant: one(tenants, {
		fields: [auditLogs.tenantId],
		references: [tenants.id]
	}),
	user: one(users, {
		fields: [auditLogs.actorId],
		references: [users.id]
	}),
}));