/**
 * Pre-submit safety checks shared by all ATS adapters.
 *
 * Before an adapter is allowed to click Submit it must confirm the required
 * fields were actually filled on the page (not just attempted). Anything
 * unverifiable stops the submit and downgrades to needs_review.
 */

const REQUIRED_SELECTOR = [
  "input[required]",
  "textarea[required]",
  "select[required]",
  'input[aria-required="true"]',
  'textarea[aria-required="true"]',
  'select[aria-required="true"]',
].join(", ");

/**
 * Scan the live DOM for required fields that are still empty.
 * @param {import('playwright').Page | import('playwright').FrameLocator} root
 * @returns {Promise<{ ok: boolean, missing: string[], error: string | null }>}
 */
export async function findMissingRequiredFields(root) {
  try {
    const missing = await root
      .locator(REQUIRED_SELECTOR)
      .evaluateAll((elements) =>
        elements
          .filter((el) => {
            const type = (el.getAttribute("type") || "").toLowerCase();
            if (type === "hidden") return false;
            if (type === "file") {
              return el.files ? el.files.length === 0 : false;
            }
            if (type === "checkbox" || type === "radio") {
              const name = el.getAttribute("name");
              if (!name) return !el.checked;
              const group = el.ownerDocument.querySelectorAll(
                `input[name="${CSS.escape(name)}"]`
              );
              return !Array.from(group).some((input) => input.checked);
            }
            return String(el.value || "").trim() === "";
          })
          .map(
            (el) =>
              el.getAttribute("name") ||
              el.getAttribute("id") ||
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.tagName.toLowerCase()
          )
      );
    return { ok: missing.length === 0, missing: [...new Set(missing)], error: null };
  } catch (error) {
    // Could not verify — treat as unsafe to submit.
    return {
      ok: false,
      missing: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Essentials that must be confirmed filled regardless of `required` markup:
 * a name, an email, and the resume upload.
 * @param {Record<string, unknown>} filled Adapter's record of confirmed fills
 * @returns {string[]} Missing essentials (empty = ok)
 */
export function findMissingEssentials(filled) {
  const missing = [];
  const hasName =
    Boolean(filled.fullName) || (Boolean(filled.firstName) && Boolean(filled.lastName));
  if (!hasName) missing.push("name");
  if (!filled.email) missing.push("email");
  if (!filled.resume) missing.push("resume");
  return missing;
}

/**
 * Run both checks; returns null when it is safe to submit, otherwise a
 * ready-to-report needs_review result.
 * @param {import('playwright').Page | import('playwright').FrameLocator} root
 * @param {string} ats
 * @param {Record<string, unknown>} filled
 */
export async function preSubmitCheck(root, ats, filled) {
  const missingEssentials = findMissingEssentials(filled);
  const requiredCheck = await findMissingRequiredFields(root);

  if (missingEssentials.length === 0 && requiredCheck.ok) return null;

  return {
    status: "needs_review",
    formPayload: {
      ats,
      filled,
      reason: "presubmit_check_failed",
      missingEssentials,
      missingRequired: requiredCheck.missing,
      verifyError: requiredCheck.error,
    },
    confirmationText: `Pre-submit check failed — not submitted (missing: ${
      [...missingEssentials, ...requiredCheck.missing].join(", ") ||
      requiredCheck.error ||
      "unknown"
    })`,
    error: null,
  };
}
