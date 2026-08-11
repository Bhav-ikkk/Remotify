/**
 * Import the locked master resume JSON into the database.
 *
 * The DB CandidateProfile.masterResume column is the source of truth for
 * resume generation and application identity (works on Vercel where local
 * files don't exist). Run this whenever the local JSON changes:
 *
 *   npm run resume:sync                  # data/master-resume.personal.json
 *   npm run resume:sync -- --file path   # custom file
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../services/database.js";
import { validateMasterResumeDocument } from "../services/resume/template.js";
import { ensureApplicationIdentity } from "../services/apply/identity.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function loadEnvFile() {
  const envPath = resolve(root, ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  }
}

function resolveSourcePath() {
  const fileFlag = process.argv.indexOf("--file");
  if (fileFlag !== -1 && process.argv[fileFlag + 1]) {
    return resolve(root, process.argv[fileFlag + 1]);
  }
  return resolve(root, "data/master-resume.personal.json");
}

function slugify(value) {
  return String(value || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  loadEnvFile();

  const sourcePath = resolveSourcePath();
  if (!existsSync(sourcePath)) {
    throw new Error(
      `Master resume JSON not found at ${sourcePath}. Create it (see data/master-resume.demo.json for the shape) or pass --file <path>.`
    );
  }

  const data = JSON.parse(readFileSync(sourcePath, "utf8"));
  const missing = validateMasterResumeDocument(data);
  if (missing.length > 0) {
    throw new Error(
      `Master resume at ${sourcePath} is incomplete (missing: ${missing.join(", ")}). Fix it before syncing.`
    );
  }

  let profile = await prisma.candidateProfile.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const contact = data.contact || {};
  if (profile) {
    profile = await prisma.candidateProfile.update({
      where: { id: profile.id },
      data: { masterResume: data },
    });
    console.log(`Updated masterResume on profile "${profile.slug}" (${profile.id})`);
  } else {
    profile = await prisma.candidateProfile.create({
      data: {
        slug: slugify(data.displayName || data.fullName),
        isActive: true,
        fullName: data.displayName || data.fullName,
        headline: data.headline || null,
        summary: data.summary || null,
        location: contact.location || null,
        email: contact.email || null,
        phone: contact.phone || null,
        portfolioUrl: contact.portfolioUrl || null,
        githubUrl: contact.githubUrl || null,
        linkedinUrl: contact.linkedinUrl || null,
        yearsExperience:
          typeof data.yearsExperience === "number" ? data.yearsExperience : null,
        masterResume: data,
      },
    });
    console.log(
      `No active profile found — created "${profile.slug}" (${profile.id}) with masterResume`
    );
  }

  const identity = await ensureApplicationIdentity();
  console.log(
    `Application identity re-synced: ${identity.fullName} <${identity.email}>`
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
