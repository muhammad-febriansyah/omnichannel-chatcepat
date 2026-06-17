import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db";

export interface ReportStats {
  conversations: number;
  resolved: number;
  contacts: number;
  optedIn: number;
  messagesOut: number; // outbound terkirim bulan ini
  convByStatus: { status: string; n: number }[];
  optInByStatus: { status: string; n: number }[];
  msgPerDay: { day: string; n: number }[]; // 7 hari terakhir
}

const FALLBACK: ReportStats = {
  conversations: 0,
  resolved: 0,
  contacts: 0,
  optedIn: 0,
  messagesOut: 0,
  convByStatus: [],
  optInByStatus: [],
  msgPerDay: [],
};

export async function getReportStats(tenantId: string | null): Promise<ReportStats> {
  if (!tenantId) return FALLBACK;
  try {
    const t = `'${tenantId}'`;
    const rows = async (q: string) => (await db.execute(sql.raw(q))) as unknown as Array<Record<string, unknown>>;

    const sum = (await rows(`select
        (select count(*) from conversations where tenant_id=${t})::int conv,
        (select count(*) from conversations where tenant_id=${t} and status='resolved')::int resolved,
        (select count(*) from contacts where tenant_id=${t})::int contacts,
        (select count(*) from contacts where tenant_id=${t} and opt_in_status='opted_in')::int opted_in,
        (select count(*) from messages where tenant_id=${t} and direction='outbound' and status in ('sent','delivered','read') and created_at >= date_trunc('month', now()))::int msg_out`))[0] ?? {};

    const convByStatus = await rows(
      `select status, count(*)::int n from conversations where tenant_id=${t} group by status order by n desc`,
    );
    const optInByStatus = await rows(
      `select opt_in_status status, count(*)::int n from contacts where tenant_id=${t} group by opt_in_status order by n desc`,
    );
    const msgPerDay = await rows(
      `select to_char(d.day, 'YYYY-MM-DD') day,
         coalesce((select count(*) from messages m where m.tenant_id=${t} and date_trunc('day', m.created_at at time zone 'Asia/Jakarta') = d.day), 0)::int n
       from generate_series(date_trunc('day', now() at time zone 'Asia/Jakarta') - interval '6 days', date_trunc('day', now() at time zone 'Asia/Jakarta'), interval '1 day') d(day)
       order by d.day`,
    );

    return {
      conversations: Number(sum.conv ?? 0),
      resolved: Number(sum.resolved ?? 0),
      contacts: Number(sum.contacts ?? 0),
      optedIn: Number(sum.opted_in ?? 0),
      messagesOut: Number(sum.msg_out ?? 0),
      convByStatus: convByStatus.map((r) => ({ status: String(r.status), n: Number(r.n) })),
      optInByStatus: optInByStatus.map((r) => ({ status: String(r.status), n: Number(r.n) })),
      msgPerDay: msgPerDay.map((r) => ({ day: String(r.day), n: Number(r.n) })),
    };
  } catch {
    return FALLBACK;
  }
}
