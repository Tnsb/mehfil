/**
 * The scheduler entry point. Point Vercel Cron (or any cron) at this route:
 * delivers scheduled notifications (T-24h reminders) and auto-fires
 * AfterParties for events that ended ~12h ago.
 *
 * Dev: `curl http://localhost:3000/api/cron`
 */
import { NextResponse } from "next/server";
import { schedulerTick } from "@/notifications/scheduler";

export async function GET() {
  const result = await schedulerTick();
  return NextResponse.json({ ok: true, ...result });
}
