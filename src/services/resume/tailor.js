import { GoogleGenAI, Type } from "@google/genai";
import { getSetting, SETTING_KEYS } from "../settings.js";
import { buildMasterResumeDocument } from "./template.js";

const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You tailor an existing ATS resume for a specific job.

The MASTER RESUME is locked — it came from the candidate's real resume PDF.
Your job is light adaptation, not rewriting their career.

Hard rules:
- Keep the same employers, schools, project names, metrics, and packages.
- Do NOT invent skills that are not already listed.
- Do NOT invent bullets about work that is not in the master resume.
- You MAY reorder projects (most relevant first) and reorder skills within categories.
- You MAY lightly rephrase the summary and bullets to emphasize overlapping keywords — same facts.
- Sound human. Ban: leveraged, utilized, passionate, results-driven, synergy, cutting-edge, robust solutions, spearheaded, seamless, excited to.
- Prefer: Built, Shipped, Owned, Integrated, Optimized, Developed, Designed.
- Keep Professional Summary to 3 sentences max.
- Keep each experience to at most 3 bullets; each project to at most 2 bullets.
- Return JSON only.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    skills: {
      type: Type.OBJECT,
      description: "Same category keys as master; values are reordered skill strings from master only",
      properties: {
        Languages: { type: Type.ARRAY, items: { type: Type.STRING } },
        Frontend: { type: Type.ARRAY, items: { type: Type.STRING } },
        Backend: { type: Type.ARRAY, items: { type: Type.STRING } },
        "AI / ML": { type: Type.ARRAY, items: { type: Type.STRING } },
        Enterprise: { type: Type.ARRAY, items: { type: Type.STRING } },
        Tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    experienceBullets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          company: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["company", "bullets"],
      },
    },
    projectOrder: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exact project names from master, best match first",
    },
    projectBullets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["name", "bullets"],
      },
    },
  },
  required: ["summary", "projectOrder"],
};

/**
 * @param {object} profile
 * @param {object|null} job
 * @param {{ apiKey?: string, useAi?: boolean }} [options]
 */
export async function tailorResumeForJob(profile, job, options = {}) {
  const master = await buildMasterResumeDocument(profile);
  if (!job) {
    return toRenderModel(master, null, null);
  }

  const useAi = options.useAi !== false;
  const apiKey = useAi ? await resolveGeminiApiKey(options.apiKey) : "";

  if (apiKey) {
    try {
      const tailored = await callGeminiTailor(apiKey, master, job);
      return toRenderModel(master, job, tailored);
    } catch (error) {
      console.error(
        "[resume:tailor] Gemini failed, using heuristic:",
        error instanceof Error ? error.message : error
      );
    }
  }

  return toRenderModel(master, job, heuristicTailor(master, job));
}

async function callGeminiTailor(apiKey, master, job) {
  const client = new GoogleGenAI({ apiKey });
  const prompt = `MASTER RESUME (locked source of truth):
${JSON.stringify(
  {
    summary: master.summary,
    skills: master.skillsByCategory,
    experience: master.experiences,
    projects: master.projects.map((p) => ({
      name: p.name,
      year: p.year,
      stack: p.stack,
      bullets: p.bullets,
    })),
    achievements: master.achievements,
    stretchRules: master.stretchRules,
  },
  null,
  2
)}

TARGET JOB:
Title: ${job.title || ""}
Company: ${job.company || ""}
Location: ${job.location || ""}
Listed skills: ${Array.isArray(job.skills) ? job.skills.join(", ") : ""}
Description:
${String(job.description || "").slice(0, 4500)}

Adapt the master resume for this job. Keep facts identical. Output JSON.`;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
    },
  });

  const text = extractText(response);
  return JSON.parse(text);
}

function heuristicTailor(master, job) {
  const blob = jobBlob(job);

  /** @type {Record<string, string[]>} */
  const skills = {};
  for (const [cat, names] of Object.entries(master.skillsByCategory || {})) {
    skills[cat] = [...names].sort((a, b) => scoreText(b, blob) - scoreText(a, blob));
  }

  const projectOrder = [...master.projects]
    .map((p) => ({
      name: p.name,
      score:
        scoreText(p.name, blob) +
        (p.stack || []).reduce((n, t) => n + scoreText(String(t), blob) * 2, 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((p) => p.name);

  let summary = master.summary;
  if (/postgres|database|sql|prisma/i.test(blob)) {
    summary =
      "Full-stack developer based in Indore, India, building production web applications with Next.js and PostgreSQL, with strong focus on schema design, query performance, and reliable backends. Currently developing full-stack and enterprise reporting systems at Express Solutions Lab, with client and open-source work spanning event management, e-commerce, and developer tooling. Active open-source contributor with published packages and sustained GitHub recognition.";
  } else if (/ai|llm|langchain|agent|genai/i.test(blob)) {
    summary =
      "Full-stack developer based in Indore, India, building production web applications with Next.js and PostgreSQL, with growing focus on GenAI-powered products using LangChain and modern LLM APIs. Currently developing full-stack systems at Express Solutions Lab, alongside client projects and open-source work spanning multi-agent tooling, automation platforms, and developer tools. Active open-source contributor with published packages and sustained GitHub recognition.";
  } else if (/react|next|front/i.test(blob)) {
    summary =
      "Full-stack developer based in Indore, India, building production web applications with Next.js, React, and PostgreSQL. Currently developing full-stack and enterprise reporting systems at Express Solutions Lab, with a track record of client projects and open-source work spanning event management, e-commerce, and developer tooling. Active open-source contributor with several published packages and sustained recognition from GitHub.";
  }

  return {
    summary,
    skills,
    experienceBullets: master.experiences.map((e) => ({
      company: e.company,
      bullets: e.bullets.slice(0, 3),
    })),
    projectOrder,
    projectBullets: master.projects.map((p) => ({
      name: p.name,
      bullets: p.bullets.slice(0, 2),
    })),
  };
}

function toRenderModel(master, job, patch) {
  const safe = patch || {};

  const skillsByCategory = sanitizeSkills(
    master.skillsByCategory,
    safe.skills || master.skillsByCategory
  );

  const expMap = new Map(
    (safe.experienceBullets || []).map((row) => [
      String(row.company || "").toLowerCase(),
      (row.bullets || []).map(String).filter(Boolean).slice(0, 3),
    ])
  );

  const experiences = master.experiences.map((e) => ({
    ...e,
    bullets: expMap.get(String(e.company).toLowerCase()) || e.bullets.slice(0, 3),
  }));

  const projectBulletMap = new Map(
    (safe.projectBullets || []).map((row) => [
      String(row.name || "").toLowerCase(),
      (row.bullets || []).map(String).filter(Boolean).slice(0, 2),
    ])
  );

  const order = Array.isArray(safe.projectOrder)
    ? safe.projectOrder.map(String)
    : master.projects.map((p) => p.name);

  const byName = new Map(master.projects.map((p) => [p.name.toLowerCase(), p]));
  const projects = [];
  const seen = new Set();
  for (const name of order) {
    const p = byName.get(name.toLowerCase());
    if (!p || seen.has(p.name)) continue;
    seen.add(p.name);
    projects.push({
      ...p,
      bullets: projectBulletMap.get(p.name.toLowerCase()) || p.bullets.slice(0, 2),
    });
  }
  for (const p of master.projects) {
    if (seen.has(p.name)) continue;
    projects.push({
      ...p,
      bullets: projectBulletMap.get(p.name.toLowerCase()) || p.bullets.slice(0, 2),
    });
  }

  const summary = String(safe.summary || master.summary)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);

  return {
    fullName: master.fullName,
    fullNameHeader: master.fullNameHeader,
    headline: master.headline,
    summary,
    contact: master.contact,
    skills: Object.values(skillsByCategory).flat(),
    skillsByCategory,
    experiences,
    projects: projects.slice(0, 4),
    education: master.education,
    achievements: master.achievements || [],
    tailoredFor: job
      ? { title: job.title || "", company: job.company || "" }
      : null,
  };
}

/**
 * Only keep skill strings that already exist on the master resume.
 * @param {Record<string, string[]>} master
 * @param {Record<string, string[]>} incoming
 */
function sanitizeSkills(master, incoming) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [cat, masterNames] of Object.entries(master || {})) {
    const allowed = new Set(masterNames.map((n) => n.toLowerCase()));
    const proposed = Array.isArray(incoming?.[cat]) ? incoming[cat] : masterNames;
    const kept = proposed
      .map(String)
      .filter((name) => allowed.has(name.toLowerCase()));
    // Ensure nothing dropped forever
    for (const name of masterNames) {
      if (!kept.some((k) => k.toLowerCase() === name.toLowerCase())) {
        kept.push(name);
      }
    }
    out[cat] = kept;
  }
  return out;
}

function scoreText(text, blob) {
  const t = String(text || "").toLowerCase();
  if (!t) return 0;
  if (blob.includes(t)) return 3;
  const parts = t.split(/[^a-z0-9.+#]+/).filter((p) => p.length > 2);
  return parts.reduce((n, p) => n + (blob.includes(p) ? 1 : 0), 0);
}

function jobBlob(job) {
  return `${job?.title || ""} ${job?.description || ""} ${(job?.skills || []).join(" ")}`.toLowerCase();
}

async function resolveGeminiApiKey(override) {
  if (typeof override === "string" && override.trim()) return override.trim();
  const envKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (envKey) return envKey;
  const fromDb = await getSetting(SETTING_KEYS.AI_API_KEY);
  const dbKey = typeof fromDb === "string" ? fromDb.trim() : "";
  if (dbKey && !/test-gemini|changeme|your.?key|placeholder/i.test(dbKey)) {
    return dbKey;
  }
  return dbKey || "";
}

function extractText(response) {
  if (!response) return "";
  if (typeof response.text === "string") return response.text;
  if (typeof response.text === "function") {
    try {
      return response.text();
    } catch {
      // fall through
    }
  }
  const parts = response?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((part) => part?.text || "").join("").trim();
  }
  return "";
}
