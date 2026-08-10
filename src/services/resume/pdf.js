import PDFDocument from "pdfkit";
import { buildMasterResume } from "./master.js";

const MARGIN = 48;
const PAGE_WIDTH = 612; // Letter
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/**
 * Generate a clean ATS-friendly resume PDF (classic layout, not "AI brochure").
 * Uses PDFKit — works on Vercel without Chromium.
 *
 * @param {object} profile Active CandidateProfile with relations
 * @param {{ job?: object }} [options]
 * @returns {Promise<{ buffer: Buffer, filename: string, resume: object }>}
 */
export async function generateMasterResumePdf(profile, options = {}) {
  const resume = buildMasterResume(profile, options);
  const buffer = await renderResumePdf(resume);
  const slug = String(profile.slug || "resume")
    .replace(/[^a-z0-9-_]/gi, "-")
    .toLowerCase();
  const company = options.job?.company
    ? `-${String(options.job.company).replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`
    : "";
  const filename = `${slug}-resume${company}.pdf`.replace(/--+/g, "-");
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
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      info: {
        Title: `${resume.fullName} — Resume`,
        Author: resume.fullName,
        Creator: "Remotify",
      },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- Header ---
    doc
      .font("Times-Bold")
      .fontSize(18)
      .fillColor("#111111")
      .text(resume.fullName, { align: "left" });

    doc
      .moveDown(0.15)
      .font("Times-Roman")
      .fontSize(10)
      .fillColor("#333333")
      .text(resume.headline || "", { align: "left" });

    const contactBits = [
      resume.location,
      resume.email,
      ...resume.links.slice(0, 3),
    ].filter(Boolean);

    doc
      .moveDown(0.2)
      .fontSize(8.5)
      .fillColor("#444444")
      .text(contactBits.join("  ·  "), {
        align: "left",
        width: CONTENT_WIDTH,
      });

    if (resume.tailoredFor?.title) {
      doc
        .moveDown(0.25)
        .font("Times-Italic")
        .fontSize(8)
        .fillColor("#555555")
        .text(
          `Prepared for: ${resume.tailoredFor.title}${
            resume.tailoredFor.company ? ` — ${resume.tailoredFor.company}` : ""
          }`
        );
    }

    rule(doc);

    // --- Summary ---
    sectionTitle(doc, "Summary");
    doc
      .font("Times-Roman")
      .fontSize(9.5)
      .fillColor("#222222")
      .text(resume.summary, {
        align: "left",
        lineGap: 1.5,
      });

    // --- Skills ---
    sectionTitle(doc, "Skills");
    const skillLine = (resume.skills || []).slice(0, 22).join(" · ");
    doc
      .font("Times-Roman")
      .fontSize(9)
      .fillColor("#222222")
      .text(skillLine, { lineGap: 1.2 });

    // --- Experience ---
    if (resume.experiences?.length) {
      sectionTitle(doc, "Experience");
      for (const exp of resume.experiences) {
        ensureSpace(doc, 70);
        doc
          .font("Times-Bold")
          .fontSize(10)
          .fillColor("#111111")
          .text(exp.title, { continued: true })
          .font("Times-Roman")
          .text(`  —  ${exp.company}`);

        const meta = [exp.tenure, exp.location].filter(Boolean).join(" · ");
        if (meta) {
          doc.font("Times-Italic").fontSize(8.5).fillColor("#555555").text(meta);
        }

        doc.moveDown(0.15);
        for (const bullet of exp.bullets || []) {
          bulletLine(doc, bullet);
        }
        doc.moveDown(0.35);
      }
    }

    // --- Projects ---
    if (resume.projects?.length) {
      sectionTitle(doc, "Selected Projects");
      for (const project of resume.projects) {
        ensureSpace(doc, 64);
        doc
          .font("Times-Bold")
          .fontSize(10)
          .fillColor("#111111")
          .text(project.name);

        if (project.tagline) {
          doc
            .font("Times-Italic")
            .fontSize(8.5)
            .fillColor("#444444")
            .text(project.tagline);
        }

        if (project.impact) {
          bulletLine(doc, project.impact);
        }
        for (const bullet of project.bullets || []) {
          bulletLine(doc, bullet);
        }
        if (project.stack?.length) {
          doc
            .font("Times-Roman")
            .fontSize(8)
            .fillColor("#555555")
            .text(`Tech: ${project.stack.join(", ")}`);
        }
        doc.moveDown(0.35);
      }
    }

    // --- Education ---
    if (resume.education?.length) {
      sectionTitle(doc, "Education");
      for (const ed of resume.education) {
        ensureSpace(doc, 40);
        doc
          .font("Times-Bold")
          .fontSize(10)
          .fillColor("#111111")
          .text(ed.degree || "Degree");
        doc
          .font("Times-Roman")
          .fontSize(9)
          .fillColor("#333333")
          .text(
            [ed.institution, ed.years].filter(Boolean).join(" · ")
          );
        if (ed.notes) {
          doc
            .font("Times-Italic")
            .fontSize(8)
            .fillColor("#555555")
            .text(ed.notes);
        }
        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

function sectionTitle(doc, title) {
  doc.moveDown(0.55);
  ensureSpace(doc, 36);
  doc
    .font("Times-Bold")
    .fontSize(10.5)
    .fillColor("#111111")
    .text(title.toUpperCase(), { characterSpacing: 0.6 });
  doc
    .moveTo(doc.page.margins.left, doc.y + 2)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y + 2)
    .strokeColor("#CCCCCC")
    .lineWidth(0.6)
    .stroke();
  doc.moveDown(0.45);
}

function rule(doc) {
  doc.moveDown(0.35);
  doc
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor("#AAAAAA")
    .lineWidth(0.8)
    .stroke();
  doc.moveDown(0.4);
}

function bulletLine(doc, text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return;
  ensureSpace(doc, 28);
  const x = doc.page.margins.left;
  const bulletX = x;
  const textX = x + 12;
  const y = doc.y;
  doc.font("Times-Roman").fontSize(9).fillColor("#222222");
  doc.text("•", bulletX, y, { width: 10, lineBreak: false });
  doc.text(cleaned, textX, y, {
    width: CONTENT_WIDTH - 12,
    lineGap: 1.2,
  });
  doc.moveDown(0.12);
}

function ensureSpace(doc, need) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + need > bottom) {
    doc.addPage();
  }
}
