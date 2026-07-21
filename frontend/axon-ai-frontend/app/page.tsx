import Link from "next/link";
import FileUploader from "@/components/upload/FileUploader";

const NAV = [
  { href: "/chat", label: "Ask Axon" },
  { href: "/graph", label: "Knowledge Graph" },
  { href: "/dashboard", label: "Dashboard" },
];

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8 space-y-8">
      <header className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Axon</h1>
        <p className="text-muted-foreground">
          Turn scattered industrial documents into a connected, queryable operations brain.
        </p>
      </header>

      <nav className="flex justify-center gap-4 text-sm">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="underline underline-offset-4 hover:text-primary">
            {item.label}
          </Link>
        ))}
      </nav>

      <section>
        <h2 className="text-lg font-medium mb-3 text-center">1. Upload your documents</h2>
        <FileUploader />
      </section>

      <p className="text-xs text-muted-foreground text-center">
        After a document finishes processing it's automatically embedded for search and added to the
        knowledge graph,then head to "Ask Axon" or "Knowledge Graph" to explore it.
      </p>
    </main>
  );
}
