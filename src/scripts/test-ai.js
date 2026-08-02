import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AIService, createGeminiProvider } from "../services/ai/index.js";
import { processJobsWithAI } from "../utils/ai-batch.js";

loadLocalEnv();

const userProfile = `Mid-level Full Stack JavaScript Engineer. Expert in React, Next.js, Node.js, and PostgreSQL.
Looking for standard remote roles. No crypto/web3. Comfortable with TypeScript and REST APIs.`;

const mockJobs = [
  {
    title: "Full Stack Engineer",
    company: "Acme Remote Labs",
    location: "USA Remote",
    salary: "$120k-$150k",
    currency: "USD",
    employmentType: "full-time",
    experience: "mid",
    description:
      "Build product features with React, Next.js, Node.js, and PostgreSQL. TypeScript preferred. Remote-first team shipping REST APIs.",
    skills: ["React", "Next.js", "Node.js", "PostgreSQL", "TypeScript"],
    applyUrl: "https://example.com/jobs/perfect-fullstack",
    companyUrl: "https://example.com",
    sourceWebsite: "mock",
    postedDate: null,
    scrapedAt: new Date(),
  },
  {
    title: "Frontend Engineer",
    company: "Partial Match Co",
    location: "Worldwide Remote",
    salary: null,
    currency: null,
    employmentType: "full-time",
    experience: "mid",
    description:
      "Own the React UI and design system. Nice-to-have: GraphQL and AWS deployment experience. Backend Node work is handled by another team.",
    skills: ["React", "JavaScript", "GraphQL", "AWS"],
    applyUrl: "https://example.com/jobs/partial-frontend",
    companyUrl: null,
    sourceWebsite: "mock",
    postedDate: null,
    scrapedAt: new Date(),
  },
  {
    title: "Solidity Smart Contract Engineer",
    company: "Crypto Nebula",
    location: "Remote",
    salary: null,
    currency: null,
    employmentType: "full-time",
    experience: "senior",
    description:
      "Design and audit Solidity contracts, DeFi protocols, and on-chain indexing. Must have deep Web3 and Ethereum experience. No traditional web stack work.",
    skills: ["Solidity", "Ethereum", "Web3", "DeFi"],
    applyUrl: "https://example.com/jobs/terrible-crypto",
    companyUrl: null,
    sourceWebsite: "mock",
    postedDate: null,
    scrapedAt: new Date(),
  },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing. Set it in .env before running test-ai.js"
    );
  }

  console.log("Remotify Phase 5 — isolated Gemini evaluation test\n");
  console.log("Profile:", userProfile.replace(/\s+/g, " ").trim(), "\n");

  const aiService = new AIService(createGeminiProvider());
  const started = Date.now();

  const scored = await processJobsWithAI(mockJobs, userProfile, 1000, {
    aiService,
  });

  for (const job of scored) {
    console.log("─".repeat(60));
    console.log(`Job: ${job.title} @ ${job.company}`);
    console.log(
      JSON.stringify(
        {
          score: job.aiScore,
          matchedSkills: job.aiMatchedSkills,
          missingSkills: job.aiMissingSkills,
          reason: job.aiReason,
        },
        null,
        2
      )
    );
  }

  console.log("─".repeat(60));
  console.log(
    `\nEvaluated ${scored.length} jobs in ${Date.now() - started}ms (with throttle).`
  );
  console.table(
    scored.map((job) => ({
      Title: job.title,
      Score: job.aiScore,
      Matched: (job.aiMatchedSkills || []).slice(0, 3).join(", "),
      Missing: (job.aiMissingSkills || []).slice(0, 3).join(", "),
    }))
  );
}

/**
 * Load .env into process.env without printing values.
 */
function loadLocalEnv() {
  try {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(dir, "../../.env");
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // ignore — caller will fail clearly if key missing
  }
}

main().catch((error) => {
  console.error("AI test failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
