import { getDashboardData } from "@/services/dashboard";

export async function GET() {
  try {
    const data = await getDashboardData();
    return Response.json({ success: true, ...data });
  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Failed to load dashboard data.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
