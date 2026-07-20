import "./globals.css";

export const metadata = {
  title: "Axon — Industrial Knowledge Intelligence",
  description: "AI-powered Industrial Brain for ET AI Hackathon 2.0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
