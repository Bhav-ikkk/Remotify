/**
 * Persist unique scraped jobs (no AI) — used to keep lead store fresh for /grab.
 */
import { scrape as scrapeSkipTheDrive } from "../scrapers/skipthedrive.js";
import { scrape as scrapeBuiltIn } from "../scrapers/builtin.js";
import { scrape as scrapeUnderdog } from "../scrapers/underdog.js";
import { scrape as scrapeJobgether } from "../scrapers/jobgether.js";
import { scrape as scrapeWellfound } from "../scrapers/wellfound.js";
import { normalizeJob } from "../normalizers/index.js";
import { filterDuplicates } from "../utils/deduplicate.js";
import { prisma } from "../services/database.js";

const scrapers = [
  { name: "skipthedrive", run: scrapeSkipTheDrive },
  { name: "builtin", run: scrapeBuiltIn },
  { name: "underdog", run: scrapeUnderdog },
  { name: "jobgether", run: scrapeJobgether },
  { name: "wellfound", run: scrapeWellfound },
];

async function main() {
  const settled = await Promise.allSettled(
    scrapers.map(async (s) => ({ name: s.name, jobs: await s.run() }))
  );

  const raw = [];
  for (let i = 0; i < settled.length; i += 1) {
    const r = settled[i];
    if (r.status === "fulfilled") {
      console.log(`${r.value.name}: ${r.value.jobs.length}`);
      raw.push(...r.value.jobs);
    } else {
      console.error(
        `${scrapers[i].name} failed:`,
        r.reason instanceof Error ? r.reason.message : r.reason
      );
    }
  }

  const normalized = raw.map((j) => normalizeJob(j));
  const { uniqueJobs, duplicateCount } = await filterDuplicates(normalized);
  console.log(
    `scraped=${raw.length} unique=${uniqueJobs.length} dupes=${duplicateCount}`
  );

  let saved = 0;
  for (const job of uniqueJobs) {
    await prisma.job.upsert({
      where: { applyUrl: job.applyUrl },
      create: {
        title: job.title,
        company: job.company,
        location: job.location || "Remote",
        isRemote: /remote/i.test(String(job.location || "")),
        remoteToken: job.location || null,
        salary: job.salary,
        currency: job.currency,
        employmentType: job.employmentType,
        experience: job.experience,
        description: job.description,
        skills: Array.isArray(job.skills) ? job.skills : [],
        applyUrl: job.applyUrl,
        companyUrl: job.companyUrl,
        sourceWebsite: job.sourceWebsite,
        postedDate: job.postedDate instanceof Date ? job.postedDate : null,
        scrapedAt: job.scrapedAt instanceof Date ? job.scrapedAt : new Date(),
        isNotified: false,
      },
      update: {
        title: job.title,
        company: job.company,
        location: job.location || "Remote",
        description: job.description,
        skills: Array.isArray(job.skills) ? job.skills : [],
        scrapedAt: job.scrapedAt instanceof Date ? job.scrapedAt : new Date(),
      },
    });
    saved += 1;
  }

  const total = await prisma.job.count();
  console.log(`persisted=${saved} totalJobs=${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
