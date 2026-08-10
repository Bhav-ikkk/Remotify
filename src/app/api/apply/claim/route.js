import { NextResponse } from "next/server";
import { claimNextApplication } from "@/services/apply/queue";
import { authorizeApplyRequest } from "@/services/apply/auth";

/**
 * POST /api/apply/claim — local worker pulls next queued application.
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
    const result = await claimNextApplication({
      workerId: body.workerId || undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Claim failed",
      },
      { status: 500 }
    );
  }
}
