import { NextResponse } from "next/server";
import {
  enqueueEligibleJobs,
  getApplyStatusSummary,
  listApplications,
} from "@/services/apply/queue";
import { buildApplicationsExcelBuffer } from "@/services/apply/export";
import { ensureApplicationIdentity } from "@/services/apply/identity";

/**
 * GET /api/applications?status=&export=1
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const wantExport = searchParams.get("export") === "1";

    if (wantExport) {
      const buffer = await buildApplicationsExcelBuffer({ status });
      const stamp = new Date().toISOString().slice(0, 10);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="remotify-applications-${stamp}.xlsx"`,
        },
      });
    }

    const [summary, applications, identity] = await Promise.all([
      getApplyStatusSummary(),
      listApplications({ status, take: 100 }),
      ensureApplicationIdentity(),
    ]);

    return NextResponse.json({
      success: true,
      summary,
      applications,
      identity: {
        id: identity.id,
        fullName: identity.fullName,
        email: identity.email,
        phone: identity.phone,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed",
      },
      { status: 500 }
    );
  }
}
