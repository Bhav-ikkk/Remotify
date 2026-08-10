/**
 * Greenhouse job board filler (boards.greenhouse.io / job-boards.greenhouse.io).
 * Best-effort field mapping; dryRun skips final Submit click.
 */

/**
 * @param {import('playwright').Page} page
 * @param {object} ctx
 */
export async function applyGreenhouse(page, ctx) {
  const { application, fields, resumePath, dryRun } = ctx;
  const filled = {};

  await page.goto(application.applyUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForTimeout(1500);

  // Prefer embedded application iframe when present
  let root = page;
  const frame = page.frameLocator('iframe[src*="greenhouse"]').first();
  try {
    await frame.locator("body").waitFor({ timeout: 3000 });
    root = frame;
  } catch {
    // stay on main page
  }

  async function fillFirst(selectors, value, key) {
    if (!value) return false;
    for (const sel of selectors) {
      const loc = root.locator(sel).first();
      try {
        if ((await loc.count()) === 0) continue;
        await loc.fill(String(value), { timeout: 3000 });
        filled[key] = value;
        return true;
      } catch {
        // try next
      }
    }
    return false;
  }

  await fillFirst(
    [
      'input[name="job_application[first_name]"]',
      'input[autocomplete="given-name"]',
      'input[name="first_name"]',
      'input[id*="first_name" i]',
    ],
    fields.firstName,
    "firstName"
  );
  await fillFirst(
    [
      'input[name="job_application[last_name]"]',
      'input[autocomplete="family-name"]',
      'input[name="last_name"]',
      'input[id*="last_name" i]',
    ],
    fields.lastName,
    "lastName"
  );
  await fillFirst(
    [
      'input[name="job_application[email]"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ],
    fields.email,
    "email"
  );
  await fillFirst(
    [
      'input[name="job_application[phone]"]',
      'input[type="tel"]',
      'input[autocomplete="tel"]',
    ],
    fields.phone,
    "phone"
  );
  await fillFirst(
    [
      'input[name*="linkedin" i]',
      'input[id*="linkedin" i]',
      'input[placeholder*="LinkedIn" i]',
    ],
    fields.linkedinUrl,
    "linkedinUrl"
  );
  await fillFirst(
    [
      'input[name*="github" i]',
      'input[id*="github" i]',
      'input[placeholder*="GitHub" i]',
    ],
    fields.githubUrl,
    "githubUrl"
  );
  await fillFirst(
    [
      'input[name*="website" i]',
      'input[name*="portfolio" i]',
      'input[id*="website" i]',
    ],
    fields.portfolioUrl,
    "portfolioUrl"
  );

  // Resume upload
  try {
    const fileInput = root.locator('input[type="file"]').first();
    if ((await fileInput.count()) > 0) {
      await fileInput.setInputFiles(resumePath);
      filled.resume = resumePath;
    }
  } catch (error) {
    filled.resumeError = error instanceof Error ? error.message : String(error);
  }

  // Cover letter / textareas
  try {
    const area = root.locator("textarea").first();
    if ((await area.count()) > 0 && fields.coverLetter) {
      await area.fill(fields.coverLetter);
      filled.coverLetter = true;
    }
  } catch {
    // ignore
  }

  if (dryRun) {
    return {
      status: "needs_review",
      formPayload: { ats: "greenhouse", dryRun: true, filled },
      confirmationText: "DRY_RUN — form filled, submit not clicked",
      error: null,
    };
  }

  // Submit
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Apply")',
  ];
  let submitted = false;
  for (const sel of submitSelectors) {
    try {
      const btn = root.locator(sel).first();
      if ((await btn.count()) === 0) continue;
      await btn.click({ timeout: 5000 });
      submitted = true;
      break;
    } catch {
      // next
    }
  }

  if (!submitted) {
    return {
      status: "needs_review",
      formPayload: { ats: "greenhouse", filled, reason: "submit_not_found" },
      confirmationText: "Filled but could not find Submit",
      error: null,
    };
  }

  await page.waitForTimeout(2500);
  return {
    status: "submitted",
    formPayload: { ats: "greenhouse", filled },
    confirmationText: "Greenhouse submit clicked",
    error: null,
  };
}
