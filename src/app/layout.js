import "./globals.css";

export const metadata = {
  title: "Remotify",
  description: "Open-source remote job intelligence pipeline",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
