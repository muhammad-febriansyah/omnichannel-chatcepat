import type { Config } from "drizzle-kit";

// Introspect skema kanonik dari DB (dimigrate Alembic di engine). Lihat docs/prd/02.
// `npm run db:pull` → lib/db/schema.ts (web JANGAN tulis DDL).
export default {
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_SYNC ??
      "postgresql://chatcepat:chatcepat@localhost:5432/chatcepat",
  },
  schema: "./lib/db/schema.ts",
  out: "./lib/db",
} satisfies Config;
