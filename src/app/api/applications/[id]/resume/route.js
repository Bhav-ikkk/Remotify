import { NextResponse } from "next/server";
import { getResumeArtifact } from "@/services/apply/artifacts";

/**
 * GET /api/applications/:id/resume — download the exact resume PDF that was
 * uploaded for this application (resume provenance).
 */
export async function GET(_request, { params }) {
  try {
    const { id } = await params;
    const artifact = await getResumeArtifact(id);
    if (!artifact) {
      return NextResponse.json(
        { success: false, message: "No stored resume for this application" },
        { status: 404 }
      );
    }

    return new NextResponse(Buffer.from(artifact.data), {
      status: 200,
      headers: {
        "Content-Type": artifact.contentType,
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        "X-Resume-Sha256": artifact.sha256,
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
