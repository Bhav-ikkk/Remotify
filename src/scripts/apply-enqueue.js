/**
 * Seed ApplicationIdentity from locked master resume + enqueue eligible jobs.
 */
import { ensureApplicationIdentity } from "../services/apply/identity.js";
import { enqueueEligibleJobs, getApplyStatusSummary } from "../services/apply/queue.js";
import { setSetting, SETTING_KEYS } from "../services/settings.js";
import { prisma } from "../services/database.js";

async function main() {
  // Sensible defaults if unset. APPLY_EMAIL_TO has no hardcoded fallback —
  // it must come from the env or be set in Settings → Apply.
  const defaults = [
    [SETTING_KEYS.DAILY_APPLY_QUOTA, 35],
    [SETTING_KEYS.APPLY_MIN_SCORE, 75],
    [SETTING_KEYS.APPLY_ENABLED, true],
    [SETTING_KEYS.APPLY_PREFER_AUTO_ATS, true],
  ];
  const envEmailTo = String(process.env.APPLY_EMAIL_TO || "").trim();
  if (envEmailTo) defaults.push([SETTING_KEYS.APPLY_EMAIL_TO, envEmailTo]);
  for (const [key, value] of defaults) {
    const existing = await prisma.setting.findUnique({ where: { key } });
    if (!existing) await setSetting(key, value);
  }

  const identity = await ensureApplicationIdentity();
  console.log("Identity:", identity.fullName, identity.email);

  const enqueued = await enqueueEligibleJobs();
  console.log("Enqueue:", enqueued);

  const summary = await getApplyStatusSummary();
  console.log("Summary:", summary);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
