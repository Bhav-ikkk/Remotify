import ExcelJS from "exceljs";
import { listApplications } from "./queue.js";

/**
 * @param {{ status?: string }} [options]
 * @returns {Promise<Buffer>}
 */
export async function buildApplicationsExcelBuffer(options = {}) {
  const rows = await listApplications({ status: options.status, take: 2000 });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Remotify";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Applications", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Status", key: "status", width: 14 },
    { header: "Score", key: "score", width: 8 },
    { header: "ATS", key: "ats", width: 12 },
    { header: "Title", key: "title", width: 36 },
    { header: "Company", key: "company", width: 24 },
    { header: "Location", key: "location", width: 18 },
    { header: "Apply URL", key: "applyUrl", width: 42 },
    { header: "Submitted At", key: "submittedAt", width: 22 },
    { header: "Error", key: "error", width: 32 },
  ];

  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8EEF5" },
  };

  for (const app of rows) {
    sheet.addRow({
      date: app.createdAt ? new Date(app.createdAt).toISOString().slice(0, 10) : "",
      status: app.status,
      score:
        typeof app.aiScore === "number" ? Math.round(app.aiScore) : "",
      ats: app.atsType,
      title: app.job?.title || "",
      company: app.job?.company || "",
      location: app.job?.location || "",
      applyUrl: app.applyUrl || "",
      submittedAt: app.submittedAt
        ? new Date(app.submittedAt).toISOString()
        : "",
      error: app.error || "",
    });
  }

  for (let i = 2; i <= sheet.rowCount; i += 1) {
    const cell = sheet.getCell(i, 8);
    const url = String(cell.value || "");
    if (url.startsWith("http")) {
      cell.value = { text: url, hyperlink: url };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
