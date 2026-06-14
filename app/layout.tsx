import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BugBoard",
  description: "Mini issue tracker for engineering teams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
