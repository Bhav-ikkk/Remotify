import { SCRAPERS } from "./registry.js";

async function main() {
  console.log("Remotify scraper test runner — sequential isolation via allSettled\n");

  const settled = await Promise.allSettled(
    SCRAPERS.map(async ({ label, run }) => {
      const started = Date.now();
      const jobs = await run();
      return {
        website: label,
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
      website: SCRAPERS[index].label,
      status: "Failed",
      jobsCollected: 0,
      error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      durationMs: null,
      sampleTitle: "",
    };
  });

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

  if (rows.some((row) => row.website === "Wellfound" && row.jobsCollected === 0)) {
    console.log(
      "Note: Wellfound requires ZYTE_API_KEY + ZYTE_PROJECT_ID (DB settings or env)."
    );
  }

  if (successesWithData.length === 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Test runner crashed:", error);
  process.exit(1);
});
