import { runPipeline } from "@/services/pipeline";
import {
  ensureSchedulerArmedForCron,
  shouldRunScheduledPipeline,
  serializeScheduler,
} from "@/services/scheduler";

export const dynamic = "force-dynamic";
// Hobby max is 60s; scheduled pipeline is capped to finish within this budget.
export const maxDuration = 60;

/**
 * Dual daily cron (Hobby-safe): vercel.json fires /api/cron twice per day.
 * Auto-arms the Neon scheduler (enabled + UTC 2/12) so alerts work without a
 * manual Settings toggle after deploy.
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

    const config = await ensureSchedulerArmedForCron();
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

    // Scheduled runs use a lean budget so Hobby's 60s limit still yields a Telegram report.
    const result = await runPipeline(false, { scheduled: true });
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
