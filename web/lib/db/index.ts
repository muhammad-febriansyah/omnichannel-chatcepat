import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";

// Cache pool di globalThis: hot-reload Next dev bikin modul baru tiap simpan —
// tanpa cache, tiap reload buka pool baru & pool lama bocor → "too many clients".
const g = globalThis as unknown as { __ccPg?: ReturnType<typeof postgres> };

// Skema + relations hasil `npm run db:pull` (introspect dari Alembic). Web JANGAN tulis DDL.
const client = g.__ccPg ?? postgres(process.env.DATABASE_URL_SYNC ?? "", { max: 10 });
if (process.env.NODE_ENV !== "production") g.__ccPg = client;

export const db = drizzle(client, { schema: { ...schema, ...relations } });

// TODO: helper db.scoped(tenantId) inject WHERE tenant_id = :tid. Tenant id dari sesi auth (jangan dari input user).
