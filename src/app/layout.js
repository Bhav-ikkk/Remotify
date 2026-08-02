import "./globals.css";
import Providers from "@/components/Providers";
import AppNav from "@/components/AppNav";

export const metadata = {
  title: "Remotify",
  description: "Open-source remote job intelligence pipeline",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppNav />
          <main
            style={{
              maxWidth: 1120,
              margin: "0 auto",
              padding: "24px 16px 48px",
            }}
          >
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
