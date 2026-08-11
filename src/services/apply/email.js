import nodemailer from "nodemailer";
import { getSetting, SETTING_KEYS } from "../settings.js";
import { sendOpsAlert } from "../telegram/alerts.js";
import { getApplyConfig } from "./queue.js";
import { buildApplicationsExcelBuffer } from "./export.js";

/**
 * Resolve free Gmail SMTP credentials (DB settings or env).
 */
export async function resolveGmailTransport() {
  const dbUser = await getSetting(SETTING_KEYS.GMAIL_USER);
  const dbPass = await getSetting(SETTING_KEYS.GMAIL_APP_PASSWORD);

  const user =
    (typeof dbUser === "string" && dbUser.trim()) ||
    process.env.GMAIL_USER?.trim() ||
    process.env.APPLY_EMAIL_FROM?.trim() ||
    "";
  const pass =
    (typeof dbPass === "string" && dbPass.trim()) ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    "";

  if (!user || !pass) {
    return { ok: false, reason: "gmail_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  return { ok: true, user, transporter };
}

/**
 * Fail closed when no recipient is configured: alert loudly and refuse to
 * send rather than falling back to any hardcoded address.
 * @param {{ emailTo?: string }} config
 * @param {string} context
 */
async function requireRecipient(config, context) {
  const emailTo = String(config?.emailTo || "").trim();
  if (emailTo) return emailTo;
  await sendOpsAlert(
    `${context} email skipped: APPLY_EMAIL_TO is not configured. Set it in Settings → Apply or as the APPLY_EMAIL_TO env var.`
  );
  return "";
}

/**
 * Send end-of-worker digest with optional Excel attachment.
 * @param {{
 *   summary: object,
 *   note?: string,
 *   attachExcel?: boolean,
 * }} payload
 */
export async function sendApplyDigestEmail(payload) {
  const config = await getApplyConfig();
  const emailTo = await requireRecipient(config, "Apply digest");
  if (!emailTo) {
    return { sent: false, reason: "apply_email_to_not_configured" };
  }
  const mail = await resolveGmailTransport();
  if (!mail.ok) {
    return { sent: false, reason: mail.reason };
  }

  const s = payload.summary || {};
  const subject = `Remotify apply digest — ${s.submittedToday ?? 0} submitted · ${s.needsReview ?? 0} review · quota ${s.used ?? 0}/${s.quota ?? 35}`;

  const text = [
    payload.note || "Local apply worker finished a batch.",
    "",
    `Enabled: ${s.enabled}`,
    `Quota used today: ${s.used ?? 0} / ${s.quota ?? 35} (remaining ${s.remaining ?? 0})`,
    `Queued: ${s.queued ?? 0}`,
    `Submitted today: ${s.submittedToday ?? 0}`,
    `Needs review: ${s.needsReview ?? 0}`,
    `Failed today: ${s.failedToday ?? 0}`,
    "",
    "Open Remotify → Applications for details.",
  ].join("\n");

  /** @type {import('nodemailer').SendMailOptions} */
  const message = {
    from: mail.user,
    to: emailTo,
    subject,
    text,
  };

  if (payload.attachExcel) {
    try {
      const excel = await buildApplicationsExcelBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      message.attachments = [
        {
          filename: `remotify-applications-${stamp}.xlsx`,
          content: excel,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      ];
    } catch (error) {
      console.warn(
        "[apply:email] excel attach failed:",
        error instanceof Error ? error.message : error
      );
    }
  }

  await mail.transporter.sendMail(message);
  return { sent: true, to: emailTo };
}

/**
 * Per-application outcome email — one real-time email per application,
 * sent right after the worker reports `submitted` or `needs_review`.
 * Includes job, company, AI score/reason, apply URL, and the exact tailored
 * resume PDF that was uploaded (when a stored artifact is provided).
 *
 * @param {{
 *   application: object,
 *   job?: object,
 *   resume?: { fileName: string, data: Buffer | Uint8Array } | null,
 * }} payload
 */
export async function sendApplicationOutcomeEmail(payload) {
  const config = await getApplyConfig();
  const emailTo = await requireRecipient(config, "Application outcome");
  if (!emailTo) {
    return { sent: false, reason: "apply_email_to_not_configured" };
  }
  const mail = await resolveGmailTransport();
  if (!mail.ok) return { sent: false, reason: mail.reason };

  const app = payload.application;
  const job = payload.job || app?.job || {};
  const submitted = app?.status === "submitted";

  const subject = submitted
    ? `Remotify submitted — ${job.title || "role"} @ ${job.company || "company"}`
    : `Remotify needs review — ${job.title || "role"} @ ${job.company || "company"}`;

  const text = [
    submitted
      ? "An application was auto-submitted. Details and the exact resume sent are below."
      : "An application could not be auto-submitted (hard ATS / captcha / unfilled required fields).",
    "",
    `Title: ${job.title || ""}`,
    `Company: ${job.company || ""}`,
    `ATS: ${app?.atsType || ""}`,
    `AI score: ${app?.aiScore ?? job.aiScore ?? ""}`,
    job.aiReason ? `AI reason: ${job.aiReason}` : null,
    `Apply: ${app?.applyUrl || job.applyUrl || ""}`,
    `Application ID: ${app?.id || ""}`,
    app?.confirmationText ? `Confirmation: ${app.confirmationText}` : null,
    app?.error ? `Error: ${app.error}` : null,
    "",
    submitted
      ? "The attached PDF is the exact tailored resume this company received."
      : "Use Telegram /approvals or open the link and submit manually with your tailored resume.",
  ]
    .filter((line) => line !== null)
    .join("\n");

  /** @type {import('nodemailer').SendMailOptions} */
  const message = {
    from: mail.user,
    to: emailTo,
    subject,
    text,
  };

  if (payload.resume?.data) {
    message.attachments = [
      {
        filename: payload.resume.fileName || "resume.pdf",
        content: Buffer.from(payload.resume.data),
        contentType: "application/pdf",
      },
    ];
  }

  await mail.transporter.sendMail(message);
  return { sent: true, to: emailTo };
}
