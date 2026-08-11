/**
 * Auth for local apply worker / enqueue endpoints.
 *
 * Fails closed: when neither APPLY_WORKER_SECRET nor CRON_SECRET is
 * configured, every request is rejected with 401 — the apply API must
 * never be reachable unauthenticated.
 */

function configuredSecret() {
  return (
    String(process.env.APPLY_WORKER_SECRET || "").trim() ||
    String(process.env.CRON_SECRET || "").trim()
  );
}

if (!configuredSecret()) {
  console.error(
    "[apply:auth] STARTUP WARNING: neither APPLY_WORKER_SECRET nor CRON_SECRET is set. " +
      "All /api/apply/* requests will be rejected with 401 until a secret is configured."
  );
}

let warnedMissingSecret = false;

/**
 * @param {Request} request
 */
export function authorizeApplyRequest(request) {
  const secret = configuredSecret();
  if (!secret) {
    if (!warnedMissingSecret) {
      warnedMissingSecret = true;
      console.error(
        "[apply:auth] Rejected apply API request: APPLY_WORKER_SECRET / CRON_SECRET not configured. " +
          "Set APPLY_WORKER_SECRET in the environment to enable the apply worker endpoints."
      );
    }
    return false;
  }
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}
