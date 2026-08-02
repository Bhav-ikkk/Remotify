import { prisma } from "@/services/database";

/**
 * Isolated connectivity probe — write / read / delete a synthetic Job row.
 * Temporary Phase 1 verification handler; remove once the pipeline is live.
 */
export async function GET() {
  let testId = null;

  try {
    const created = await prisma.job.create({
      data: {
        title: "Connectivity Probe Engineer",
        company: "Remotify Healthcheck",
        location: "Worldwide Remote",
        isRemote: true,
        remoteToken: "Worldwide Remote",
        salary: null,
        currency: null,
        employmentType: "full-time",
        experience: null,
        description:
          "Synthetic record used solely to verify Neon write/read/delete loops.",
        skills: ["postgresql", "prisma", "next.js"],
        applyUrl: `https://remotify.local/healthcheck/${Date.now()}`,
        companyUrl: null,
        sourceWebsite: "phase1-test-db",
        postedDate: null,
        aiScore: 0,
        aiMatchedSkills: [],
        aiMissingSkills: [],
        aiReason: "Synthetic connectivity probe — not a real match.",
      },
    });

    testId = created.id;

    const readBack = await prisma.job.findUnique({
      where: { id: testId },
    });

    if (!readBack || readBack.id !== testId) {
      return Response.json(
        {
          success: false,
          message: "Write succeeded but read-back failed verification.",
        },
        { status: 500 }
      );
    }

    await prisma.job.delete({
      where: { id: testId },
    });

    testId = null;

    return Response.json({
      success: true,
      message: "Database engine connectivity verified securely.",
    });
  } catch (error) {
    if (testId) {
      try {
        await prisma.job.delete({ where: { id: testId } });
      } catch {
        // Best-effort cleanup; surface the original failure below.
      }
    }

    return Response.json(
      {
        success: false,
        message: "Database connectivity verification failed.",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
