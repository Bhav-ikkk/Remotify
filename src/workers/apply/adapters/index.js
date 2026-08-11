import { canAutoSubmit } from "../../../services/apply/ats.js";
import { identityToFormFields } from "../../../services/apply/identity.js";
import { applyGreenhouse } from "./greenhouse.js";
import { applyLever } from "./lever.js";
import { applyAshby } from "./ashby.js";

/**
 * Route to ATS adapter.
 * @param {import('playwright').Page} page
 * @param {{
 *   application: object,
 *   job: object,
 *   identity: object,
 *   resumePath: string,
 *   dryRun: boolean,
 * }} ctx
 */
export async function runAtsAdapter(page, ctx) {
  const ats = String(ctx.application.atsType || "unknown").toLowerCase();
  const fields = identityToFormFields(ctx.identity);

  if (!canAutoSubmit(ats)) {
    return {
      status: "needs_review",
      formPayload: { reason: "unsupported_ats", atsType: ats, fields },
      confirmationText: `ATS ${ats} requires manual submit`,
      error: null,
    };
  }

  const adapters = {
    greenhouse: applyGreenhouse,
    lever: applyLever,
    ashby: applyAshby,
  };

  const fn = adapters[ats];
  if (!fn) {
    return {
      status: "needs_review",
      formPayload: { reason: "no_adapter", atsType: ats },
      confirmationText: null,
      error: null,
    };
  }

  return fn(page, { ...ctx, fields });
}
