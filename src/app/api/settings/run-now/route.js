import { runPipeline } from "@/services/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual pipeline trigger used by Settings "Run Scraper Now".
 */
export async function POST() {
  try {
    const result = await runPipeline(true);

    if (result.aborted) {
      return Response.json(
        {
          success: false,
          message: result.reason || "Pipeline aborted.",
          result,
        },
        { status: 409 }
      );
    }

    return Response.json({
      success: Boolean(result.success),
      message:
        result.status === "failed"
          ? "Pipeline finished with failures."
          : "Pipeline completed.",
      result,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to start pipeline.",
      },
      { status: 500 }
    );
  }
}
