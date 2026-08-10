import "./globals.css";
import { Syne, Source_Sans_3 } from "next/font/google";
import Providers from "@/components/Providers";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "Remotify — Apply with intent, not volume",
  description:
    "Self-hostable open-source pipeline that scrapes remote jobs, scores fit, builds ATS resumes, and auto-applies on Greenhouse, Lever, and Ashby.",
  openGraph: {
    title: "Remotify — Apply with intent, not volume",
    description:
      "Quality-gated remote job apply stack you run yourself. Open source. $0 hosting.",
    images: ["/remotify-mark.png"],
  },
  icons: {
    icon: "/remotify-mark.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${syne.variable} ${sourceSans.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
