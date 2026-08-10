import nodemailer from "nodemailer";
import { getSetting, SETTING_KEYS } from "../settings.js";
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
 * Send end-of-worker digest with optional Excel attachment.
 * @param {{
 *   summary: object,
 *   note?: string,
 *   attachExcel?: boolean,
 * }} payload
 */
export async function sendApplyDigestEmail(payload) {
  const config = await getApplyConfig();
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
    to: config.emailTo,
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
  return { sent: true, to: config.emailTo };
}

/**
 * Notify about a single needs_review application.
 * @param {{ application: object, job?: object }} payload
 */
export async function sendNeedsReviewEmail(payload) {
  const config = await getApplyConfig();
  const mail = await resolveGmailTransport();
  if (!mail.ok) return { sent: false, reason: mail.reason };

  const app = payload.application;
  const job = payload.job || app?.job || {};
  const subject = `Remotify needs review — ${job.title || "role"} @ ${job.company || "company"}`;
  const text = [
    "An application could not be auto-submitted (hard ATS / captcha / unknown form).",
    "",
    `Title: ${job.title || ""}`,
    `Company: ${job.company || ""}`,
    `ATS: ${app?.atsType || ""}`,
    `Score: ${app?.aiScore ?? ""}`,
    `Apply: ${app?.applyUrl || job.applyUrl || ""}`,
    `Application ID: ${app?.id || ""}`,
    "",
    "Use Telegram /approvals or open the link and submit manually with your tailored resume.",
  ].join("\n");

  await mail.transporter.sendMail({
    from: mail.user,
    to: config.emailTo,
    subject,
    text,
  });
  return { sent: true, to: config.emailTo };
}
