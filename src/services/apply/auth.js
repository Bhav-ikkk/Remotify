/**
 * Auth for local apply worker / enqueue endpoints.
 * @param {Request} request
 */
export function authorizeApplyRequest(request) {
  const secret =
    String(process.env.APPLY_WORKER_SECRET || "").trim() ||
    String(process.env.CRON_SECRET || "").trim();
  if (!secret) return true;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}
