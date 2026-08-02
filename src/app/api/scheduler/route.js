import { z } from "zod";
import {
  getSchedulerConfig,
  serializeScheduler,
  updateSchedulerConfig,
} from "@/services/scheduler";

const schedulerUpdateSchema = z.object({
  isEnabled: z.boolean().optional(),
  targetHourUtc: z.number().int().min(0).max(23).nullable().optional(),
  cronExpression: z.string().max(120).nullable().optional(),
  nextRunAt: z.string().datetime().nullable().optional(),
});

export async function GET() {
  try {
    const config = await getSchedulerConfig();
    return Response.json({
      success: true,
      scheduler: serializeScheduler(config),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Failed to load scheduler configuration.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const parsed = schedulerUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: "Invalid scheduler payload.",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const config = await updateSchedulerConfig(parsed.data);
    return Response.json({
      success: true,
      message: "Scheduler configuration updated.",
      scheduler: serializeScheduler(config),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Failed to update scheduler configuration.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
