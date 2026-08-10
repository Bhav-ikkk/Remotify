import { NextResponse } from "next/server";
import { enqueueEligibleJobs } from "@/services/apply/queue";
import { authorizeApplyRequest } from "@/services/apply/auth";

/**
 * POST /api/apply/enqueue
 * Auth: Bearer CRON_SECRET or APPLY_WORKER_SECRET (or open in local if unset)
 */
export async function POST(request) {
  try {
    if (!authorizeApplyRequest(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await enqueueEligibleJobs({
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Enqueue failed",
      },
      { status: 500 }
    );
  }
}
