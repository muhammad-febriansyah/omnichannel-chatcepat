import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

// Skema + relations hasil `npm run db:pull` (introspect dari Alembic). Web JANGAN tulis DDL.
const client = postgres(process.env.DATABASE_URL_SYNC ?? "");

export const db = drizzle(client, { schema: { ...schema, ...relations } });

// TODO: helper db.scoped(tenantId) inject WHERE tenant_id = :tid. Tenant id dari sesi auth (jangan dari input user).
