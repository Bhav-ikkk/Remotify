import { runPipeline } from "@/services/pipeline";
import {
  getSchedulerConfig,
  shouldRunScheduledPipeline,
  serializeScheduler,
} from "@/services/scheduler";

export const dynamic = "force-dynamic";
// Hobby max is 60s; keep pipeline lean so both daily runs finish within the free tier.
export const maxDuration = 60;

/**
 * Dual daily cron (Hobby-safe): vercel.json fires /api/cron twice per day.
 * Pipeline runs only when SchedulerConfig is enabled and UTC hour matches
 * the configured morning/evening windows.
 * Optional protection: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 */
export async function GET(request) {
  try {
    if (!authorizeCron(request)) {
      return Response.json(
        { success: false, message: "Unauthorized cron request." },
        { status: 401 }
      );
    }

    const config = await getSchedulerConfig();
    const now = new Date();

    if (!shouldRunScheduledPipeline(config, now)) {
      return Response.json({
        success: true,
        triggered: false,
        message: "Scheduler conditions not met — no run started.",
        scheduler: serializeScheduler(config),
        utcHour: now.getUTCHours(),
      });
    }

    const result = await runPipeline(false);
    return Response.json({
      success: Boolean(result.success),
      triggered: !result.aborted,
      result,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Cron handler failed.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}

/**
 * @param {Request} request
 */
function authorizeCron(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}
