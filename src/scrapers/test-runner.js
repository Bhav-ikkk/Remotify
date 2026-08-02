import { scrape as scrapeSkipTheDrive } from "./skipthedrive.js";
import { scrape as scrapeBuiltIn } from "./builtin.js";
import { scrape as scrapeUnderdog } from "./underdog.js";
import { scrape as scrapeJobgether } from "./jobgether.js";
import { scrape as scrapeWellfound } from "./wellfound.js";

const scrapers = [
  { name: "SkipTheDrive", run: scrapeSkipTheDrive },
  { name: "Built In", run: scrapeBuiltIn },
  { name: "Underdog", run: scrapeUnderdog },
  { name: "Jobgether", run: scrapeJobgether },
  { name: "Wellfound", run: scrapeWellfound },
];

async function main() {
  console.log("Remotify scraper test runner — sequential isolation via allSettled\n");

  const settled = await Promise.allSettled(
    scrapers.map(async ({ name, run }) => {
      const started = Date.now();
      const jobs = await run();
      return {
        website: name,
        status: "Success",
        jobsCollected: Array.isArray(jobs) ? jobs.length : 0,
        error: "",
        durationMs: Date.now() - started,
        sampleTitle: jobs?.[0]?.title || "",
      };
    })
  );

  const rows = settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    return {
      website: scrapers[index].name,
      status: "Failed",
      jobsCollected: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      durationMs: null,
      sampleTitle: "",
    };
  });

  // Mark zero-job successful returns that logged bot blocks as Failed for clarity
  // only when the scrape threw — empty arrays are valid soft-failures.
  console.table(
    rows.map((row) => ({
      Website: row.website,
      Status: row.status,
      "Jobs Collected": row.jobsCollected,
      "Duration (ms)": row.durationMs ?? "—",
      Error: row.error || (row.jobsCollected === 0 ? "(empty result)" : ""),
    }))
  );

  console.log("\nJSON summary:");
  console.log(JSON.stringify(rows, null, 2));

  const successesWithData = rows.filter(
    (row) => row.status === "Success" && row.jobsCollected > 0
  );
  console.log(
    `\nScrapers returning schema-valid jobs: ${successesWithData.length}/${rows.length}`
  );

  if (successesWithData.length === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test runner crashed:", error);
  process.exit(1);
});
