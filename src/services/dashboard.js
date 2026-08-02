import { prisma } from "@/services/database";
import { getSetting, SETTING_KEYS } from "@/services/settings";
import { getSchedulerConfig, serializeScheduler } from "@/services/scheduler";

/**
 * Aggregate dashboard KPIs, top matches, and recent run history.
 */
export async function getDashboardData() {
  const minScoreRaw = await getSetting(SETTING_KEYS.MIN_MATCH_SCORE);
  const minMatchScore =
    typeof minScoreRaw === "number" && Number.isFinite(minScoreRaw)
      ? minScoreRaw
      : 85;

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const [
    totalJobs,
    todayJobs,
    highScoreMatches,
    topMatches,
    recentRuns,
    scheduler,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({
      where: { scrapedAt: { gte: startOfToday } },
    }),
    prisma.job.count({
      where: { aiScore: { gte: minMatchScore } },
    }),
    prisma.job.findMany({
      where: { aiScore: { not: null } },
      orderBy: { aiScore: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        remoteToken: true,
        salary: true,
        aiScore: true,
        applyUrl: true,
        sourceWebsite: true,
      },
    }),
    prisma.runHistory.findMany({
      orderBy: { startedAt: "desc" },
      take: 10,
    }),
    getSchedulerConfig(),
  ]);

  return {
    metrics: {
      totalJobs,
      todayJobs,
      highScoreMatches,
      minMatchScore,
    },
    topMatches,
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      durationMs: run.durationMs,
      status: run.status,
      jobsParsed: run.jobsParsed,
      jobsDeduplicated: run.jobsDeduplicated,
      jobsProcessed: run.jobsProcessed,
      jobsMatched: run.jobsMatched,
      errorCount: run.errorCount,
    })),
    scheduler: serializeScheduler(scheduler),
  };
}
