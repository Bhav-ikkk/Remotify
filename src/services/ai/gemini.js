import { GoogleGenAI, Type } from "@google/genai";

const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are a strict, objective technical recruiter for remote / product engineering roles.
Score how well a candidate profile matches a job posting.

Scoring guidance:
- Weight stack fit (Next.js/React/Node/Postgres/AI-in-products) and remote eligibility heavily when the profile lists them as priorities.
- Treat shipped projects with real users/clients as strong evidence — stronger than buzzwords alone.
- Penalize hard mismatches: required years far above profile, on-site only when candidate is remote-seeking, unrelated stacks (e.g. pure native mobile / Java-only) when listed under Avoid.
- Do NOT require FAANG pedigree. Junior/mid full-stack with production ownership can score high when the stack aligns.
- Be conservative on matchedSkills: only mark skills clearly evidenced in the profile (skills list, projects, or experience).
- missingSkills should list important job requirements not evidenced — not every optional nice-to-have.
Return ONLY JSON matching the required schema. Do not invent employer requirements that are not in the job text.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "Match score from 0 to 100",
    },
    matchedSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Skills present in both the profile and the job",
    },
    missingSkills: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Important job skills missing from the profile",
    },
    reason: {
      type: Type.STRING,
      description: "One or two sentences explaining the score",
    },
  },
  required: ["score", "matchedSkills", "missingSkills", "reason"],
};

/**
 * Gemini-backed AI provider implementing the evaluateJob strategy contract.
 */
export class GeminiProvider {
  /**
   * @param {{ apiKey?: string, model?: string }} [options]
   */
  constructor(options = {}) {
    const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is required to initialize GeminiProvider"
      );
    }

    this.model = options.model || MODEL;
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   * @param {object} job
   * @param {string} userProfile
   */
  async evaluateJob(job, userProfile) {
    const prompt = buildPrompt(job, userProfile);

    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      },
    });

    const text = extractText(response);
    const parsed = parseEvaluationJson(text);
    return {
      score: clampScore(parsed.score),
      matchedSkills: asStringArray(parsed.matchedSkills),
      missingSkills: asStringArray(parsed.missingSkills),
      reason: String(parsed.reason || "").trim() || "No reason provided.",
      raw: parsed,
    };
  }
}

/**
 * Factory for the Gemini strategy provider.
 * @param {{ apiKey?: string, model?: string }} [options]
 */
export function createGeminiProvider(options = {}) {
  return new GeminiProvider(options);
}

/**
 * @param {object} job
 * @param {string} userProfile
 */
function buildPrompt(job, userProfile) {
  const skills = Array.isArray(job?.skills) ? job.skills.join(", ") : "";

  return `Candidate profile (structured from their personal database — use priorities + project evidence):
${String(userProfile || "").trim()}

Job posting:
Title: ${job?.title || ""}
Company: ${job?.company || ""}
Location: ${job?.location || ""}
Skills: ${skills || "Not listed"}
Description:
${String(job?.description || "").slice(0, 6000)}

Evaluate fit for THIS candidate. Prefer roles matching their target roles and high-weight priorities.
Respond with JSON fields score, matchedSkills, missingSkills, reason.`;
}

/**
 * @param {unknown} response
 */
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
    return parts
      .map((part) => part?.text || "")
      .join("")
      .trim();
  }

  return "";
}

/**
 * @param {string} text
 */
function parseEvaluationJson(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Gemini returned an empty response");
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Gemini returned invalid JSON");
  }
}

/**
 * @param {unknown} value
 */
function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}
