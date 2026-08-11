import { NextResponse } from "next/server";
import {
  enqueueEligibleJobs,
  getApplyStatusSummary,
  listApplications,
} from "@/services/apply/queue";
import { buildApplicationsExcelBuffer } from "@/services/apply/export";
import {
  ensureApplicationIdentity,
  getActiveIdentity,
} from "@/services/apply/identity";

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

    const [summary, applications] = await Promise.all([
      getApplyStatusSummary(),
      listApplications({ status, take: 100 }),
    ]);

    // Identity resolution needs a complete master resume in the DB; the list
    // view should still load when it's missing, surfacing the error instead.
    let identity = null;
    let identityError = null;
    try {
      identity = await ensureApplicationIdentity();
    } catch (error) {
      identityError = error instanceof Error ? error.message : String(error);
      identity = await getActiveIdentity();
    }

    return NextResponse.json({
      success: true,
      summary,
      applications,
      identity: identity
        ? {
            id: identity.id,
            fullName: identity.fullName,
            email: identity.email,
            phone: identity.phone,
          }
        : null,
      identityError,
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
