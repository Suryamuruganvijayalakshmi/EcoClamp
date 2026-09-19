import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EcoClamp — AIoT Smart Resource Conservation Platform",
  description:
    "EcoClamp helps industries monitor machine-level electrical behavior, identify abnormal energy consumption, forecast operating trends, and generate actionable recommendations for smarter energy and resource management.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="light" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--page)] text-[var(--ink-primary)]">{children}</body>
    </html>
  );
}
