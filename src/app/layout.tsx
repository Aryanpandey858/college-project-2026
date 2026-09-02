// layout.tsx: Root layout wrapper for the Next.js surveillance application, declaring HTML metadata and global font/theme styling.

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
