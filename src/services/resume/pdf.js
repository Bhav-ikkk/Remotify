import PDFDocument from "pdfkit";
import { tailorResumeForJob } from "./tailor.js";

const MARGIN_X = 48;
const MARGIN_Y = 40;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONT = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
};

const COLOR = {
  text: "#000000",
  muted: "#333333",
  line: "#000000",
};

/**
 * Generate ATS resume PDF matching the locked master resume layout.
 *
 * @param {object} profile
 * @param {{ job?: object, useAi?: boolean, apiKey?: string }} [options]
 */
export async function generateMasterResumePdf(profile, options = {}) {
  const resume = await tailorResumeForJob(profile, options.job || null, {
    useAi: options.useAi !== false,
    apiKey: options.apiKey,
  });

  const buffer = await renderResumePdf(resume);
  const slug = String(profile?.slug || resume.fullName || "resume")
    .replace(/[^a-z0-9-_]/gi, "-")
    .toLowerCase();

  let companyBit = "";
  if (options.job?.company) {
    companyBit = `-${String(options.job.company)
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 28)}`;
  }

  const filename = `${slug}-resume${companyBit}.pdf`.replace(/--+/g, "-");
  return { buffer, filename, resume };
}

/**
 * @param {object} resume
 * @returns {Promise<Buffer>}
 */
function renderResumePdf(resume) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: {
        top: MARGIN_Y,
        bottom: MARGIN_Y,
        left: MARGIN_X,
        right: MARGIN_X,
      },
      info: {
        Title: `${resume.fullName} - Resume`,
        Author: resume.fullName,
        Creator: "Remotify",
      },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, resume);

    section(doc, "Professional Summary");
    paragraph(doc, resume.summary);

    section(doc, "Technical Skills");
    drawSkills(doc, resume.skillsByCategory || {});

    if (resume.experiences?.length) {
      section(doc, "Professional Experience");
      for (const exp of resume.experiences) drawExperience(doc, exp);
    }

    if (resume.projects?.length) {
      section(doc, "Projects");
      for (const project of resume.projects) drawProject(doc, project);
    }

    if (resume.education?.length) {
      section(doc, "Education");
      for (const ed of resume.education) drawEducation(doc, ed);
    }

    if (resume.achievements?.length) {
      section(doc, "Achievements & Open Source");
      for (const item of resume.achievements) bullet(doc, item);
    }

    doc.end();
  });
}

function drawHeader(doc, resume) {
  doc
    .font(FONT.bold)
    .fontSize(16)
    .fillColor(COLOR.text)
    .text(String(resume.fullNameHeader || resume.fullName || "").toUpperCase(), {
      align: "center",
      characterSpacing: 1.2,
    });

  const c = resume.contact || {};
  const line1 = [c.location, c.phone, c.email].filter(Boolean).join("  |  ");
  const line2 = [
    c.portfolio ? `Portfolio: ${c.portfolio}` : null,
    c.github ? `GitHub: ${c.github}` : null,
    c.linkedin ? `LinkedIn: ${c.linkedin}` : null,
  ]
    .filter(Boolean)
    .join("  |  ");

  doc.moveDown(0.25).font(FONT.regular).fontSize(9).fillColor(COLOR.text);
  if (line1) doc.text(line1, { align: "center" });
  if (line2) doc.text(line2, { align: "center" });
  doc.moveDown(0.35);
}

function drawSkills(doc, categories) {
  for (const [category, names] of Object.entries(categories)) {
    if (!names?.length) continue;
    ensureSpace(doc, 18);
    doc
      .font(FONT.bold)
      .fontSize(9.5)
      .fillColor(COLOR.text)
      .text(`${category}: `, { continued: true });
    doc
      .font(FONT.regular)
      .text(names.join(", "), { width: CONTENT_WIDTH, lineGap: 1 });
  }
}

function drawExperience(doc, exp) {
  ensureSpace(doc, 54);
  const left = `${exp.title} — ${exp.company}`;
  row(doc, left, exp.tenure || "", FONT.bold, 10);
  if (exp.location) {
    doc.font(FONT.regular).fontSize(9).fillColor(COLOR.muted).text(exp.location);
  }
  doc.moveDown(0.1);
  for (const b of exp.bullets || []) bullet(doc, b);
  doc.moveDown(0.22);
}

function drawProject(doc, project) {
  ensureSpace(doc, 52);
  row(doc, project.name || "", project.year || "", FONT.bold, 10);
  if (project.stack?.length) {
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(project.stack.join(", "));
  }
  doc.moveDown(0.08);
  for (const b of (project.bullets || []).slice(0, 3)) bullet(doc, b);
  doc.moveDown(0.22);
}

function drawEducation(doc, ed) {
  ensureSpace(doc, 28);
  const left = `${ed.degree}${ed.institution ? ` — ${ed.institution}` : ""}`;
  row(doc, left, ed.years || "", FONT.regular, 9.5);
  doc.moveDown(0.12);
}

function section(doc, title) {
  doc.moveDown(0.4);
  ensureSpace(doc, 26);
  doc
    .font(FONT.bold)
    .fontSize(10.5)
    .fillColor(COLOR.text)
    .text(title.toUpperCase(), { characterSpacing: 0.4 });
  const y = doc.y + 1;
  doc
    .moveTo(MARGIN_X, y)
    .lineTo(PAGE_WIDTH - MARGIN_X, y)
    .strokeColor(COLOR.line)
    .lineWidth(1)
    .stroke();
  doc.y = y + 6;
}

function row(doc, left, right, font, size) {
  const y = doc.y;
  doc.font(font).fontSize(size).fillColor(COLOR.text);
  const rightW = right ? doc.widthOfString(right) + 4 : 0;
  doc.text(left, MARGIN_X, y, {
    width: Math.max(120, CONTENT_WIDTH - rightW - 6),
    lineBreak: false,
  });
  if (right) {
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.text)
      .text(right, MARGIN_X, y, { width: CONTENT_WIDTH, align: "right" });
  }
  doc.x = MARGIN_X;
  doc.y = y + size + 2;
}

function paragraph(doc, text) {
  doc
    .font(FONT.regular)
    .fontSize(9.5)
    .fillColor(COLOR.text)
    .text(String(text || "").trim(), {
      width: CONTENT_WIDTH,
      align: "left",
      lineGap: 1.4,
    });
}

function bullet(doc, text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return;
  ensureSpace(doc, 24);
  const y = doc.y;
  doc.font(FONT.regular).fontSize(9.2).fillColor(COLOR.text);
  doc.text("•", MARGIN_X, y, { width: 10, lineBreak: false });
  doc.text(cleaned, MARGIN_X + 11, y, {
    width: CONTENT_WIDTH - 11,
    lineGap: 1.25,
  });
  doc.moveDown(0.06);
}

function ensureSpace(doc, need) {
  if (doc.y + need > PAGE_HEIGHT - MARGIN_Y) doc.addPage();
}

export { tailorResumeForJob } from "./tailor.js";
