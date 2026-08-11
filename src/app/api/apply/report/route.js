import { NextResponse } from "next/server";
import { z } from "zod";
import { reportApplication, getApplyStatusSummary } from "@/services/apply/queue";
import { sendApplicationOutcomeEmail } from "@/services/apply/email";
import { getResumeArtifact } from "@/services/apply/artifacts";
import { authorizeApplyRequest } from "@/services/apply/auth";
import { sendOpsAlert } from "@/services/telegram/alerts";
import { prisma } from "@/services/database";

const reportSchema = z.object({
  applicationId: z.string().min(1),
  status: z.enum(["submitted", "needs_review", "failed", "skipped", "queued"]),
  formPayload: z.record(z.string(), z.unknown()).optional(),
  error: z.string().nullish(),
  confirmationText: z.string().nullish(),
  resumeFileName: z.string().nullish(),
  resumeMeta: z.record(z.string(), z.unknown()).optional(),
});

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

    const parsed = reportSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const application = await reportApplication({
      applicationId: body.applicationId,
      status: body.status,
      formPayload: body.formPayload,
      error: body.error || undefined,
      confirmationText: body.confirmationText || undefined,
      resumeFileName: body.resumeFileName || undefined,
      resumeMeta: body.resumeMeta,
    });

    // Real-time record: one email per application on submit or review,
    // with the exact stored resume PDF attached when available.
    if (application.status === "submitted" || application.status === "needs_review") {
      try {
        const artifact = await getResumeArtifact(application.id);
        const result = await sendApplicationOutcomeEmail({
          application,
          job: application.job,
          resume: artifact
            ? { fileName: artifact.fileName, data: artifact.data }
            : null,
        });
        if (result.sent) {
          await prisma.application.update({
            where: { id: application.id },
            data: { emailSentAt: new Date() },
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await sendOpsAlert(
          `Outcome email failed for application ${application.id} (${application.job?.title || ""} @ ${application.job?.company || ""}): ${message}`
        );
      }
    }

    if (application.status === "failed") {
      await sendOpsAlert(
        `Application failed: ${application.job?.title || "role"} @ ${application.job?.company || "company"} (${application.atsType}) — ${application.error || "no error detail"} · id ${application.id}`
      );
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
