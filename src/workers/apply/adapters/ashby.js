/**
 * Ashby jobs.ashbyhq.com filler (best-effort).
 */
import { preSubmitCheck } from "./verify.js";

/**
 * @param {import('playwright').Page} page
 * @param {object} ctx
 */
export async function applyAshby(page, ctx) {
  const { application, fields, resumePath, dryRun } = ctx;
  const filled = {};

  await page.goto(application.applyUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  try {
    const applyBtn = page
      .locator('button:has-text("Apply"), a:has-text("Apply")')
      .first();
    if ((await applyBtn.count()) > 0) {
      await applyBtn.click({ timeout: 4000 });
      await page.waitForTimeout(1200);
    }
  } catch {
    // form may already be open
  }

  async function fillByLabelHints(hints, value, key) {
    if (!value) return;
    for (const hint of hints) {
      try {
        const byLabel = page.getByLabel(new RegExp(hint, "i")).first();
        if ((await byLabel.count()) > 0) {
          await byLabel.fill(String(value), { timeout: 3000 });
          filled[key] = value;
          return;
        }
      } catch {
        // next
      }
      try {
        const byPlaceholder = page
          .locator(`input[placeholder*="${hint}" i], textarea[placeholder*="${hint}" i]`)
          .first();
        if ((await byPlaceholder.count()) > 0) {
          await byPlaceholder.fill(String(value), { timeout: 3000 });
          filled[key] = value;
          return;
        }
      } catch {
        // next
      }
    }
  }

  await fillByLabelHints(["first name", "given name"], fields.firstName, "firstName");
  await fillByLabelHints(["last name", "family name", "surname"], fields.lastName, "lastName");
  await fillByLabelHints(["full name", "name"], fields.fullName, "fullName");
  await fillByLabelHints(["email"], fields.email, "email");
  await fillByLabelHints(["phone", "mobile"], fields.phone, "phone");
  await fillByLabelHints(["linkedin"], fields.linkedinUrl, "linkedinUrl");
  await fillByLabelHints(["github"], fields.githubUrl, "githubUrl");
  await fillByLabelHints(["website", "portfolio"], fields.portfolioUrl, "portfolioUrl");

  try {
    const file = page.locator('input[type="file"]').first();
    if ((await file.count()) > 0) {
      await file.setInputFiles(resumePath);
      filled.resume = resumePath;
    }
  } catch (error) {
    filled.resumeError = error instanceof Error ? error.message : String(error);
  }

  if (dryRun) {
    return {
      status: "needs_review",
      formPayload: { ats: "ashby", dryRun: true, filled },
      confirmationText: "DRY_RUN — Ashby form filled, submit not clicked",
      error: null,
    };
  }

  // Safety check: confirm required fields were actually filled before Submit
  const blocked = await preSubmitCheck(page, "ashby", filled);
  if (blocked) return blocked;

  try {
    const submit = page
      .locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Submit application")'
      )
      .first();
    if ((await submit.count()) === 0) {
      return {
        status: "needs_review",
        formPayload: { ats: "ashby", filled, reason: "submit_not_found" },
        confirmationText: "Filled but could not find Submit",
        error: null,
      };
    }
    await submit.click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    return {
      status: "submitted",
      formPayload: { ats: "ashby", filled },
      confirmationText: "Ashby submit clicked",
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      formPayload: { ats: "ashby", filled },
      confirmationText: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
