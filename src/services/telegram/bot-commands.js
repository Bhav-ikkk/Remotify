import {
  resolveTelegramCredentials,
  telegramApi,
  sendTelegramDocument,
} from "./client.js";
import {
  buildJobsExcelBuffer,
  grabFilename,
  queryGrabJobs,
} from "../export/jobs-excel.js";
import { getProfileSummary, getActiveProfile } from "../profile.js";
import { generateMasterResumePdf } from "../resume/pdf.js";
import {
  getApplyStatusSummary,
  listApplications,
  reportApplication,
  enqueueEligibleJobs,
  buildApplyDigestText,
} from "../apply/queue.js";
import { prisma } from "../database.js";

const BOT_COMMANDS = [
  {
    command: "grab",
    description: "Excel of all scraped apply-open leads (last 30 days)",
  },
  {
    command: "matches",
    description: "Excel of AI-matched leads only",
  },
  {
    command: "resume",
    description: "ATS resume PDF tailored to best current job match",
  },
  {
    command: "apply_status",
    description: "Auto-apply quota and queue snapshot",
  },
  {
    command: "apply_digest",
    description: "Daily apply KPI digest (submitted / review / skips)",
  },
  {
    command: "approvals",
    description: "List applications needing manual review",
  },
  {
    command: "approve",
    description: "Mark needs_review application as submitted: /approve <id>",
  },
  {
    command: "skip",
    description: "Skip a needs_review application: /skip <id>",
  },
  {
    command: "help",
    description: "List Remotify bot commands",
  },
  {
    command: "status",
    description: "Profile + lead counts snapshot",
  },
];

/**
 * Register slash commands with Telegram.
 * @param {string} [token]
 */
export async function registerBotCommands(token) {
  const { token: resolved } = await resolveTelegramCredentials();
  const botToken = String(token || resolved || "").trim();
  if (!botToken) throw new Error("Telegram bot token missing");

  const data = await telegramApi(botToken, "setMyCommands", {
    commands: BOT_COMMANDS,
  });
  if (!data?.ok) {
    throw new Error(data?.description || "setMyCommands failed");
  }
  return { ok: true, commands: BOT_COMMANDS };
}

/**
 * Point Telegram webhook at this deployment.
 * @param {string} webhookUrl Absolute HTTPS URL to /api/telegram/webhook
 * @param {string} [secretToken]
 */
export async function setTelegramWebhook(webhookUrl, secretToken) {
  const { token } = await resolveTelegramCredentials();
  if (!token) throw new Error("Telegram bot token missing");

  const payload = {
    url: webhookUrl,
    allowed_updates: ["message", "channel_post"],
    drop_pending_updates: false,
  };
  if (secretToken) payload.secret_token = secretToken;

  const data = await telegramApi(token, "setWebhook", payload);
  if (!data?.ok) {
    throw new Error(data?.description || "setWebhook failed");
  }
  return data;
}

/**
 * Handle an incoming Telegram Update (message or channel_post).
 * @param {object} update
 */
export async function handleTelegramUpdate(update) {
  const message = update?.message || update?.channel_post;
  if (!message) {
    return { handled: false, reason: "no_message" };
  }

  const text = String(message.text || message.caption || "").trim();
  if (!text.startsWith("/")) {
    return { handled: false, reason: "not_command" };
  }

  const { token, chatId: configuredChatId } = await resolveTelegramCredentials();
  if (!token) {
    return { handled: false, reason: "no_token" };
  }

  const chatId = String(message.chat?.id || configuredChatId || "");
  if (!chatId) {
    return { handled: false, reason: "no_chat" };
  }

  if (configuredChatId && !chatAllowed(configuredChatId, message)) {
    return { handled: false, reason: "chat_mismatch" };
  }

  const command = parseCommand(text);

  switch (command.name) {
    case "start":
    case "help":
      await sendText(token, chatId, helpText());
      return { handled: true, command: command.name };

    case "grab":
      return handleGrab(token, chatId, "all", command.args);

    case "matches":
      return handleGrab(token, chatId, "matches", command.args);

    case "resume":
      return handleResume(token, chatId);

    case "status":
      return handleStatus(token, chatId);

    case "apply_status":
      return handleApplyStatus(token, chatId);

    case "apply_digest":
      return handleApplyDigest(token, chatId);

    case "approvals":
      return handleApprovals(token, chatId);

    case "approve":
      return handleApproveSkip(token, chatId, command.args, "submitted");

    case "skip":
      return handleApproveSkip(token, chatId, command.args, "skipped");

    case "enqueue":
      return handleEnqueue(token, chatId);

    default:
      await sendText(
        token,
        chatId,
        `Unknown command <code>${escapeHtml(command.name)}</code>. Try /help`
      );
      return { handled: true, command: command.name, unknown: true };
  }
}

/**
 * @param {string} configured
 * @param {object} message
 */
function chatAllowed(configured, message) {
  const chatId = String(message.chat?.id || "");
  const username = String(message.chat?.username || "");
  const cfg = String(configured).trim();
  if (!cfg) return true;
  if (cfg === chatId) return true;
  if (cfg.replace(/^-100/, "") === chatId.replace(/^-100/, "")) return true;
  if (cfg.replace(/^@/, "") === username) return true;
  return false;
}

/**
 * @param {string} token
 * @param {string} chatId
 * @param {'all'|'matches'} mode
 * @param {string[]} args
 */
async function handleGrab(token, chatId, mode, args) {
  const days = parseDaysArg(args) || 30;
  await sendText(
    token,
    chatId,
    mode === "matches"
      ? `📊 Building matched leads Excel (last ${days} days)…`
      : `📥 Building all apply-open leads Excel (last ${days} days)…`
  );

  const { jobs } = await queryGrabJobs({ mode, days });
  if (jobs.length === 0) {
    await sendText(
      token,
      chatId,
      mode === "matches"
        ? "No matched leads in that window yet. Run the pipeline or lower min match score."
        : "No scraped leads with apply URLs in that window yet."
    );
    return {
      handled: true,
      command: mode === "matches" ? "matches" : "grab",
      count: 0,
    };
  }

  const buffer = await buildJobsExcelBuffer(jobs, { mode });
  const filename = grabFilename(mode);

  await sendTelegramDocument(token, chatId, buffer, filename, {
    caption:
      mode === "matches"
        ? `🎯 ${jobs.length} AI-matched leads (last ${days}d)`
        : `📋 ${jobs.length} apply-open leads (last ${days}d)\nUse /matches for scored fits only.`,
  });

  return {
    handled: true,
    command: mode === "matches" ? "matches" : "grab",
    count: jobs.length,
  };
}

/**
 * @param {string} token
 * @param {string} chatId
 */
async function handleResume(token, chatId) {
  await sendText(token, chatId, "📄 Generating tailored ATS resume PDF…");
  const profile = await getActiveProfile();
  if (!profile) {
    await sendText(
      token,
      chatId,
      "No active candidate profile. Run <code>npm run profile:seed</code> first."
    );
    return { handled: true, command: "resume", ok: false };
  }

  // Prefer highest AI-matched job so /resume is useful for applying now
  const { prisma } = await import("../database.js");
  const job = await prisma.job.findFirst({
    where: { aiScore: { gte: 50 }, applyUrl: { not: "" } },
    orderBy: [{ aiScore: "desc" }, { scrapedAt: "desc" }],
  });

  const { buffer, filename } = await generateMasterResumePdf(profile, {
    job: job || undefined,
    useAi: true,
  });

  const caption = job
    ? `ATS resume tailored for ${job.title} @ ${job.company}`
    : `Master ATS resume — ${profile.fullName}`;

  await sendTelegramDocument(token, chatId, buffer, filename, { caption });
  return { handled: true, command: "resume", ok: true, tailored: Boolean(job) };
}

/**
 * @param {string} token
 * @param {string} chatId
 */
async function handleStatus(token, chatId) {
  const summary = await getProfileSummary();
  const { jobs: allJobs } = await queryGrabJobs({ mode: "all", days: 30 });
  const { jobs: matchJobs } = await queryGrabJobs({ mode: "matches", days: 30 });
  const apply = await getApplyStatusSummary();

  const lines = [
    "<b>Remotify status</b>",
    summary.configured
      ? `Profile: <b>${escapeHtml(summary.profile.fullName)}</b> · ${summary.profile.skillCount} skills · ${summary.profile.projectCount} projects`
      : "Profile: <i>not configured</i>",
    `Leads (30d): <b>${allJobs.length}</b> apply-open · <b>${matchJobs.length}</b> matched`,
    `Apply today: <b>${apply.used}/${apply.quota}</b> · queued ${apply.queued} · review ${apply.needsReview}`,
    "",
    "Commands: /grab · /matches · /resume · /apply_status · /approvals · /help",
  ];
  await sendText(token, chatId, lines.join("\n"));
  return { handled: true, command: "status" };
}

async function handleApplyStatus(token, chatId) {
  const s = await getApplyStatusSummary();
  await sendText(
    token,
    chatId,
    [
      "<b>Auto-apply status</b>",
      `Enabled: <b>${s.enabled ? "yes" : "no"}</b>`,
      `Prefer auto ATS: <b>${s.preferAutoAts ? "yes" : "no"}</b>`,
      `Quota today: <b>${s.used}/${s.quota}</b> (remaining ${s.remaining})`,
      `Min score: ${s.minScore}`,
      `Queued: ${s.queued} (auto ATS ${s.queuedAuto}) · In progress: ${s.preparing}`,
      `Submitted today: ${s.submittedToday}`,
      `Needs review: ${s.needsReview}`,
      `Failed today: ${s.failedToday}`,
      `CRM submit rate: ${s.responseRate}%`,
      "",
      "Local worker: <code>npm run apply:worker</code> · digest: /apply_digest",
    ].join("\n")
  );
  return { handled: true, command: "apply_status" };
}

async function handleApplyDigest(token, chatId) {
  const text = await buildApplyDigestText();
  await sendText(token, chatId, text);
  return { handled: true, command: "apply_digest" };
}

async function handleApprovals(token, chatId) {
  const rows = await listApplications({ status: "needs_review", take: 10 });
  if (rows.length === 0) {
    await sendText(token, chatId, "No applications in <b>needs_review</b>.");
    return { handled: true, command: "approvals", count: 0 };
  }

  const lines = [
    `<b>Needs review (${rows.length})</b>`,
    ...rows.map((app, i) => {
      const title = escapeHtml(app.job?.title || "role");
      const company = escapeHtml(app.job?.company || "");
      const id = escapeHtml(app.id);
      const url = escapeHtml(app.applyUrl);
      return `${i + 1}. ${title} @ ${company}\n<code>${id}</code>\n<a href="${url}">Apply link</a>\n/approve ${id} · /skip ${id}`;
    }),
  ];
  await sendText(token, chatId, lines.join("\n\n"));
  return { handled: true, command: "approvals", count: rows.length };
}

/**
 * @param {string} token
 * @param {string} chatId
 * @param {string[]} args
 * @param {'submitted'|'skipped'} status
 */
async function handleApproveSkip(token, chatId, args, status) {
  const id = String(args?.[0] || "").trim();
  if (!id) {
    await sendText(
      token,
      chatId,
      status === "submitted"
        ? "Usage: <code>/approve &lt;applicationId&gt;</code>"
        : "Usage: <code>/skip &lt;applicationId&gt;</code>"
    );
    return { handled: true, command: status === "submitted" ? "approve" : "skip", ok: false };
  }

  const existing = await prisma.application.findUnique({ where: { id } });
  if (!existing) {
    await sendText(token, chatId, `No application <code>${escapeHtml(id)}</code>`);
    return { handled: true, command: status === "submitted" ? "approve" : "skip", ok: false };
  }

  const updated = await reportApplication({
    applicationId: id,
    status,
    confirmationText:
      status === "submitted" ? "Marked submitted via Telegram /approve" : "Skipped via Telegram /skip",
  });

  await sendText(
    token,
    chatId,
    `Application <code>${escapeHtml(id)}</code> → <b>${escapeHtml(updated.status)}</b>\n${escapeHtml(updated.job?.title || "")} @ ${escapeHtml(updated.job?.company || "")}`
  );
  return { handled: true, command: status === "submitted" ? "approve" : "skip", ok: true };
}

async function handleEnqueue(token, chatId) {
  await sendText(token, chatId, "Enqueueing eligible jobs…");
  const result = await enqueueEligibleJobs();
  await sendText(
    token,
    chatId,
    result.enabled === false
      ? "Apply queue is disabled in settings."
      : `Enqueued <b>${result.enqueued}</b>. Remaining quota capacity: ${result.remaining}/${result.quota ?? 35}.`
  );
  return { handled: true, command: "enqueue", ...result };
}

function helpText() {
  return [
    "<b>Remotify bot</b>",
    "",
    "/grab — Excel of <b>all</b> scraped leads with apply links (last 30 days)",
    "/grab 7 — same, last 7 days",
    "/matches — Excel of <b>AI-matched</b> leads only",
    "/resume — ATS resume PDF tailored to your best current match",
    "/apply_status — auto-apply quota + queue",
    "/apply_digest — daily apply KPI digest",
    "/approvals — needs_review list",
    "/approve &lt;id&gt; — mark reviewed app as submitted",
    "/skip &lt;id&gt; — skip a reviewed app",
    "/status — profile + lead counts",
    "/help — this message",
    "",
    "Run <code>npm run apply:worker</code> locally to fill Greenhouse/Lever/Ashby forms ($0).",
  ].join("\n");
}

/**
 * @param {string} text
 */
function parseCommand(text) {
  const raw = text.split(/\s+/)[0] || "";
  const name = raw.replace(/^\//, "").split("@")[0].toLowerCase();
  const args = text.split(/\s+/).slice(1);
  return { name, args };
}

/**
 * @param {string[]} args
 */
function parseDaysArg(args) {
  const n = Number(args?.[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), 90);
}

/**
 * @param {string} token
 * @param {string} chatId
 * @param {string} text
 */
async function sendText(token, chatId, text) {
  return telegramApi(token, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export { BOT_COMMANDS };
