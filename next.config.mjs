/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright is local-worker only — never bundle into Vercel.
  serverExternalPackages: ["playwright", "pdfkit"],
};

export default nextConfig;
