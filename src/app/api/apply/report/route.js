import { NextResponse } from "next/server";
import { reportApplication, getApplyStatusSummary } from "@/services/apply/queue";
import { sendNeedsReviewEmail } from "@/services/apply/email";
import { authorizeApplyRequest } from "@/services/apply/auth";
import { prisma } from "@/services/database";

/**
 * POST /api/apply/report — worker reports submit / needs_review / failed.
 */
export async function POST(request) {
  try {
    if (!authorizeApplyRequest(request)) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    if (!body?.applicationId || !body?.status) {
      return NextResponse.json(
        { success: false, message: "applicationId and status required" },
        { status: 400 }
      );
    }

    const application = await reportApplication({
      applicationId: body.applicationId,
      status: body.status,
      formPayload: body.formPayload,
      error: body.error,
      confirmationText: body.confirmationText,
      resumeFileName: body.resumeFileName,
      resumeMeta: body.resumeMeta,
    });

    if (application.status === "needs_review") {
      try {
        await sendNeedsReviewEmail({ application, job: application.job });
        await prisma.application.update({
          where: { id: application.id },
          data: { emailSentAt: new Date() },
        });
      } catch (error) {
        console.warn(
          "[apply:report] needs_review email failed:",
          error instanceof Error ? error.message : error
        );
      }
    }

    const summary = await getApplyStatusSummary();
    return NextResponse.json({ success: true, application, summary });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Report failed",
      },
      { status: 500 }
    );
  }
}
