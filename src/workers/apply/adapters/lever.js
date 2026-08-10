/**
 * Lever jobs.lever.co filler.
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} ctx
 */
export async function applyLever(page, ctx) {
  const { application, fields, resumePath, dryRun } = ctx;
  const filled = {};

  await page.goto(application.applyUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1200);

  // Open application form if needed
  try {
    const applyBtn = page
      .locator('a:has-text("Apply"), button:has-text("Apply for this job")')
      .first();
    if ((await applyBtn.count()) > 0) {
      await applyBtn.click({ timeout: 4000 });
      await page.waitForTimeout(1000);
    }
  } catch {
    // already on form
  }

  async function fill(sel, value, key) {
    if (!value) return;
    try {
      const loc = page.locator(sel).first();
      if ((await loc.count()) === 0) return;
      await loc.fill(String(value), { timeout: 3000 });
      filled[key] = value;
    } catch {
      // ignore
    }
  }

  await fill('input[name="name"]', fields.fullName, "fullName");
  await fill('input[name="email"]', fields.email, "email");
  await fill('input[name="phone"]', fields.phone, "phone");
  await fill('input[name="org"]', "", "org");
  await fill('input[name="urls[LinkedIn]"]', fields.linkedinUrl, "linkedinUrl");
  await fill('input[name="urls[GitHub]"]', fields.githubUrl, "githubUrl");
  await fill(
    'input[name="urls[Portfolio]"]',
    fields.portfolioUrl,
    "portfolioUrl"
  );

  try {
    const file = page.locator('input[type="file"]').first();
    if ((await file.count()) > 0) {
      await file.setInputFiles(resumePath);
      filled.resume = resumePath;
    }
  } catch (error) {
    filled.resumeError = error instanceof Error ? error.message : String(error);
  }

  try {
    const comments = page.locator('textarea[name="comments"]').first();
    if ((await comments.count()) > 0 && fields.coverLetter) {
      await comments.fill(fields.coverLetter);
      filled.coverLetter = true;
    }
  } catch {
    // ignore
  }

  if (dryRun) {
    return {
      status: "needs_review",
      formPayload: { ats: "lever", dryRun: true, filled },
      confirmationText: "DRY_RUN — Lever form filled, submit not clicked",
      error: null,
    };
  }

  try {
    const submit = page
      .locator(
        'button[type="submit"], button:has-text("Submit application"), input[type="submit"]'
      )
      .first();
    if ((await submit.count()) === 0) {
      return {
        status: "needs_review",
        formPayload: { ats: "lever", filled, reason: "submit_not_found" },
        confirmationText: "Filled but could not find Submit",
        error: null,
      };
    }
    await submit.click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    return {
      status: "submitted",
      formPayload: { ats: "lever", filled },
      confirmationText: "Lever submit clicked",
      error: null,
    };
  } catch (error) {
    return {
      status: "failed",
      formPayload: { ats: "lever", filled },
      confirmationText: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
