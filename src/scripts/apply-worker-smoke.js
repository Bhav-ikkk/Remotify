/**
 * Greenhouse board smoke — verifies ATS public API + schema for auto-apply leads.
 * Does not submit applications.
 *
 * Usage: node src/scripts/apply-worker-smoke.js
 */
import { http } from "../scrapers/http.js";
import { detectAtsType, canAutoSubmit } from "../services/apply/ats.js";
import { scrape as scrapeAtsBoards } from "../scrapers/ats-boards.js";
import { titlePassesQualityFilter } from "../utils/job-quality.js";

async function main() {
  console.log("Apply worker smoke — Greenhouse/Lever/Ashby lead path\n");

  const stripe = await http.get(
    "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true"
  );
  const stripeJobs = Array.isArray(stripe.data?.jobs) ? stripe.data.jobs : [];
  console.log(`stripe greenhouse jobs: ${stripeJobs.length}`);

  const sampleUrl = stripeJobs[0]?.id
    ? `https://boards.greenhouse.io/stripe/jobs/${stripeJobs[0].id}`
    : stripeJobs[0]?.absolute_url || "";
  const ats = detectAtsType(sampleUrl);
  console.log(`sample ATS detect: ${ats} autoSubmit=${canAutoSubmit(ats)} url=${sampleUrl}`);
  // Also verify company-hosted gh_jid URLs
  const hosted = detectAtsType(
    stripeJobs[0]?.absolute_url || "https://stripe.com/jobs/search?gh_jid=1"
  );
  console.log(`hosted gh_jid detect: ${hosted}`);
  if (!canAutoSubmit(ats) || hosted !== "greenhouse") {
    throw new Error("Expected greenhouse auto-submit detection to pass");
  }

  const boardJobs = await scrapeAtsBoards();
  const quality = boardJobs.filter((j) => titlePassesQualityFilter(j.title));
  const auto = quality.filter((j) => canAutoSubmit(detectAtsType(j.applyUrl)));

  console.log(
    JSON.stringify(
      {
        atsBoardJobs: boardJobs.length,
        qualityTitles: quality.length,
        autoSubmitable: auto.length,
        sample: auto.slice(0, 5).map((j) => ({
          title: j.title,
          company: j.company,
          ats: detectAtsType(j.applyUrl),
          url: j.applyUrl,
        })),
      },
      null,
      2
    )
  );

  if (auto.length === 0) {
    console.warn(
      "Warning: no auto-submitable quality titles from target companies — check data/target-companies.json"
    );
    process.exitCode = 1;
    return;
  }

  console.log("\nSmoke OK — run worker against queued apps with:");
  console.log("  npm run apply:worker:dry");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
