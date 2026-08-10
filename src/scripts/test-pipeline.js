/**
 * Persist unique scraped jobs (no AI) — used to keep lead store fresh for /grab.
 */
import { SCRAPERS } from "../scrapers/registry.js";
import { normalizeJob } from "../normalizers/index.js";
import { filterDuplicates } from "../utils/deduplicate.js";
import { prefilterJobsForScoring } from "../utils/job-quality.js";
import { prisma } from "../services/database.js";

async function main() {
  console.log("Remotify pipeline smoke — scrape → normalize → quality → dedupe\n");

  const settled = await Promise.allSettled(
    SCRAPERS.map(async ({ label, run }) => {
      const jobs = await run();
      return { name: label, jobs: Array.isArray(jobs) ? jobs : [] };
    })
  );

  const perSource = settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return {
        source: result.value.name,
        scraped: result.value.jobs.length,
        jobs: result.value.jobs,
        error: "",
      };
    }
    return {
      source: SCRAPERS[index].label,
      scraped: 0,
      jobs: [],
      error:
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason),
    };
  });

  console.table(
    perSource.map((row) => ({
      Source: row.source,
      Scraped: row.scraped,
      Error: row.error || "",
    }))
  );

  const flattened = perSource.flatMap((row) => row.jobs);
  const totalScraped = flattened.length;

  const normalized = [];
  let normalizeErrors = 0;
  for (const job of flattened) {
    try {
      normalized.push(normalizeJob(job));
    } catch (error) {
      normalizeErrors += 1;
      console.error(
        "normalizeJob failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  const { uniqueJobs, duplicateCount } = await filterDuplicates(normalized);
  const qualityJobs = prefilterJobsForScoring(uniqueJobs);

  console.log("\nPipeline summary");
  console.table([
    {
      "Total Scraped": totalScraped,
      Normalized: normalized.length,
      "Normalize Errors": normalizeErrors,
      "Duplicates Removed": duplicateCount,
      "Final Unique Count": uniqueJobs.length,
      "Quality Filtered": qualityJobs.length,
    },
  ]);

  const sample = qualityJobs.slice(0, 8).map((job) => ({
    Title: job.title,
    Company: String(job.company || "").slice(0, 28),
    Location: job.location,
    Skills: (job.skills || []).slice(0, 4).join(", "),
    Source: job.sourceWebsite,
  }));

  if (sample.length) {
    console.log("\nSample quality-filtered unique jobs");
    console.table(sample);
  }

  console.log(
    "\nJSON summary:",
    JSON.stringify(
      {
        totalScraped,
        normalized: normalized.length,
        normalizeErrors,
        duplicatesRemoved: duplicateCount,
        finalUniqueCount: uniqueJobs.length,
        qualityFiltered: qualityJobs.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Pipeline test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
