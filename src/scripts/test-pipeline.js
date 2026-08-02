import { scrape as scrapeSkipTheDrive } from "../scrapers/skipthedrive.js";
import { scrape as scrapeBuiltIn } from "../scrapers/builtin.js";
import { scrape as scrapeUnderdog } from "../scrapers/underdog.js";
import { scrape as scrapeJobgether } from "../scrapers/jobgether.js";
import { scrape as scrapeWellfound } from "../scrapers/wellfound.js";
import { normalizeJob } from "../normalizers/index.js";
import { filterDuplicates } from "../utils/deduplicate.js";
import { prisma } from "../services/database.js";

const scrapers = [
  { name: "SkipTheDrive", run: scrapeSkipTheDrive },
  { name: "Built In", run: scrapeBuiltIn },
  { name: "Underdog", run: scrapeUnderdog },
  { name: "Jobgether", run: scrapeJobgether },
  { name: "Wellfound", run: scrapeWellfound },
];

async function main() {
  console.log("Remotify Phase 4 pipeline — scrape → normalize → dedupe\n");

  const settled = await Promise.allSettled(
    scrapers.map(async ({ name, run }) => {
      const jobs = await run();
      return { name, jobs: Array.isArray(jobs) ? jobs : [] };
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
      source: scrapers[index].name,
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

  console.log("\nPipeline summary");
  console.table([
    {
      "Total Scraped": totalScraped,
      Normalized: normalized.length,
      "Normalize Errors": normalizeErrors,
      "Duplicates Removed": duplicateCount,
      "Final Unique Count": uniqueJobs.length,
    },
  ]);

  const sample = uniqueJobs.slice(0, 8).map((job) => ({
    Title: job.title,
    Company: job.company.slice(0, 28),
    Location: job.location,
    Skills: job.skills.slice(0, 4).join(", "),
    Source: job.sourceWebsite,
  }));

  if (sample.length) {
    console.log("\nSample normalized unique jobs");
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
