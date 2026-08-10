/**
 * Smoke-test claim → mark needs_review without browser (CI-safe).
 */
import {
  claimNextApplication,
  reportApplication,
  getApplyStatusSummary,
} from "../services/apply/queue.js";
import { prisma } from "../services/database.js";

async function main() {
  const claim = await claimNextApplication({ workerId: "smoke-test" });
  console.log("claim:", {
    claimed: claim.claimed,
    reason: claim.reason,
    id: claim.application?.id,
    ats: claim.application?.atsType,
    title: claim.application?.job?.title,
  });

  if (!claim.claimed) return;

  const reported = await reportApplication({
    applicationId: claim.application.id,
    status: "needs_review",
    formPayload: { smoke: true },
    confirmationText: "Smoke test — no browser",
  });
  console.log("reported:", reported.status, reported.id);

  console.log("summary:", await getApplyStatusSummary());
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
