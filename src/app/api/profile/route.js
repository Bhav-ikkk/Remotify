import { NextResponse } from "next/server";
import { getActiveProfile, getProfileSummary } from "@/services/profile";

/**
 * GET /api/profile — active candidate profile for dashboard / debugging.
 * ?full=1 includes relations (skills, projects, etc).
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const full = searchParams.get("full") === "1";

    if (full) {
      const profile = await getActiveProfile();
      return NextResponse.json({
        success: true,
        configured: Boolean(profile),
        profile,
      });
    }

    const summary = await getProfileSummary();
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Profile fetch failed",
      },
      { status: 500 }
    );
  }
}
