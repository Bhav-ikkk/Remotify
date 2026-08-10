/**
 * Detect ATS provider from an apply URL.
 * @param {string} applyUrl
 * @returns {'greenhouse'|'lever'|'ashby'|'workday'|'unknown'}
 */
export function detectAtsType(applyUrl) {
  const raw = String(applyUrl || "").trim().toLowerCase();
  if (!raw) return "unknown";

  let host = "";
  let url = null;
  try {
    url = new URL(raw);
    host = url.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }

  // Company-hosted Greenhouse boards often use ?gh_jid= on their careers site
  if (
    url.searchParams.has("gh_jid") ||
    /[?&]gh_jid=\d+/.test(raw) ||
    host.includes("greenhouse.io") ||
    host.includes("boards.greenhouse") ||
    host.includes("job-boards.greenhouse")
  ) {
    return "greenhouse";
  }
  if (host.includes("lever.co") || host.includes("jobs.lever")) {
    return "lever";
  }
  if (host.includes("ashbyhq.com") || host.includes("jobs.ashby")) {
    return "ashby";
  }
  if (
    host.includes("myworkdayjobs.com") ||
    host.includes("workday.com") ||
    host.includes("wd1.myworkday") ||
    host.includes("wd3.myworkday") ||
    /wd\d+\.myworkdayjobs\.com/.test(host)
  ) {
    return "workday";
  }

  return "unknown";
}

/** ATS types the local worker will attempt to auto-submit. */
export const AUTO_SUBMIT_ATS = new Set(["greenhouse", "lever", "ashby"]);

/**
 * @param {string} atsType
 */
export function canAutoSubmit(atsType) {
  return AUTO_SUBMIT_ATS.has(String(atsType || "").toLowerCase());
}
