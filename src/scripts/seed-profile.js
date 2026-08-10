import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

/**
 * Prefer personal (gitignored) profile for local/prod DB seeding.
 * Fall back to committed demo profile for open-source clones.
 */
function loadProfilePayload() {
  const personalPath = resolve(root, "data/profile.personal.json");
  const demoPath = resolve(root, "data/profile.demo.json");
  const forceDemo =
    process.env.PROFILE_SEED_DEMO === "1" ||
    process.argv.includes("--demo");

  const path = !forceDemo && existsSync(personalPath) ? personalPath : demoPath;
  if (!existsSync(path)) {
    throw new Error(`Profile JSON not found at ${path}`);
  }

  const raw = JSON.parse(readFileSync(path, "utf8"));
  return { path, raw };
}

/**
 * @param {string | null | undefined} value
 */
function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function seedProfile() {
  const { path, raw } = loadProfilePayload();
  console.log(`[profile:seed] loading ${path}`);

  const slug = String(raw.slug || "default").trim();
  if (!slug) throw new Error("Profile slug is required");

  const existing = await prisma.candidateProfile.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    await prisma.candidateProfile.delete({ where: { id: existing.id } });
    console.log(`[profile:seed] replaced existing profile slug=${slug}`);
  }

  // Only one active profile for matching — deactivate others after insert.
  const profile = await prisma.candidateProfile.create({
    data: {
      slug,
      isActive: raw.isActive !== false,
      fullName: raw.fullName,
      headline: raw.headline || null,
      summary: raw.summary || null,
      location: raw.location || null,
      email: raw.email || null,
      phone: raw.phone || null,
      websiteUrl: raw.websiteUrl || null,
      portfolioUrl: raw.portfolioUrl || null,
      githubUrl: raw.githubUrl || null,
      linkedinUrl: raw.linkedinUrl || null,
      yearsExperience:
        typeof raw.yearsExperience === "number" ? raw.yearsExperience : null,
      availability: raw.availability || null,
      workAuth: Array.isArray(raw.workAuth) ? raw.workAuth.map(String) : [],
      targetRoles: Array.isArray(raw.targetRoles)
        ? raw.targetRoles.map(String)
        : [],
      targetCompanies: Array.isArray(raw.targetCompanies)
        ? raw.targetCompanies.map(String)
        : [],
      avoidRoles: Array.isArray(raw.avoidRoles)
        ? raw.avoidRoles.map(String)
        : [],
      masterResume: raw.masterResume ?? null,
      rawProfile: raw,
      skills: {
        create: (Array.isArray(raw.skills) ? raw.skills : []).map((s) => ({
          name: String(s.name),
          category: s.category ? String(s.category) : null,
          proficiency: s.proficiency ? String(s.proficiency) : null,
          years: typeof s.years === "number" ? s.years : null,
          keywords: Array.isArray(s.keywords) ? s.keywords.map(String) : [],
        })),
      },
      projects: {
        create: (Array.isArray(raw.projects) ? raw.projects : []).map((p) => ({
          slug: String(p.slug),
          name: String(p.name),
          tagline: p.tagline ? String(p.tagline) : null,
          description: p.description ? String(p.description) : null,
          role: p.role ? String(p.role) : null,
          status: p.status ? String(p.status) : null,
          featured: Boolean(p.featured),
          impact: p.impact ? String(p.impact) : null,
          stack: Array.isArray(p.stack) ? p.stack.map(String) : [],
          highlights: Array.isArray(p.highlights)
            ? p.highlights.map(String)
            : [],
          liveUrl: p.liveUrl ? String(p.liveUrl) : null,
          repoUrl: p.repoUrl ? String(p.repoUrl) : null,
          sortOrder: typeof p.sortOrder === "number" ? p.sortOrder : 0,
        })),
      },
      experiences: {
        create: (Array.isArray(raw.experiences) ? raw.experiences : []).map(
          (e) => ({
            company: String(e.company),
            title: String(e.title),
            location: e.location ? String(e.location) : null,
            employmentType: e.employmentType
              ? String(e.employmentType)
              : null,
            startDate: parseDate(e.startDate),
            endDate: parseDate(e.endDate),
            isCurrent: Boolean(e.isCurrent),
            description: e.description ? String(e.description) : null,
            highlights: Array.isArray(e.highlights)
              ? e.highlights.map(String)
              : [],
            stack: Array.isArray(e.stack) ? e.stack.map(String) : [],
          })
        ),
      },
      education: {
        create: (Array.isArray(raw.education) ? raw.education : []).map(
          (ed) => ({
            institution: String(ed.institution),
            degree: ed.degree ? String(ed.degree) : null,
            field: ed.field ? String(ed.field) : null,
            startYear: typeof ed.startYear === "number" ? ed.startYear : null,
            endYear: typeof ed.endYear === "number" ? ed.endYear : null,
            notes: ed.notes ? String(ed.notes) : null,
          })
        ),
      },
      priorities: {
        create: (Array.isArray(raw.priorities) ? raw.priorities : []).map(
          (pr) => ({
            key: String(pr.key),
            label: String(pr.label),
            weight: typeof pr.weight === "number" ? pr.weight : 50,
            notes: pr.notes ? String(pr.notes) : null,
          })
        ),
      },
      sources: {
        create: (Array.isArray(raw.sources) ? raw.sources : []).map((src) => ({
          type: String(src.type || "manual"),
          url: src.url ? String(src.url) : null,
          label: src.label ? String(src.label) : null,
          scrapedAt: parseDate(src.scrapedAt),
          raw: src.raw ?? null,
        })),
      },
    },
  });

  if (profile.isActive) {
    await prisma.candidateProfile.updateMany({
      where: { id: { not: profile.id }, isActive: true },
      data: { isActive: false },
    });
  }

  const counts = await prisma.candidateProfile.findUnique({
    where: { id: profile.id },
    select: {
      _count: {
        select: {
          skills: true,
          projects: true,
          experiences: true,
          education: true,
          priorities: true,
          sources: true,
        },
      },
    },
  });

  console.log(
    `[profile:seed] upserted ${profile.fullName} (${profile.slug})`,
    counts?._count
  );
}

seedProfile()
  .catch((error) => {
    console.error("[profile:seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
