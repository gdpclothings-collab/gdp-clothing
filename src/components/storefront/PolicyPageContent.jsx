import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

function renderContent(content) {
  const lines = String(content || "").split("\n");
  const nodes = [];
  let bullets = [];

  const flushBullets = () => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={`list-${nodes.length}`} className="my-4 list-disc space-y-2 pl-6 text-[15px] leading-7 text-foreground/85">
        {bullets.map((item, index) => <li key={index}>{item}</li>)}
      </ul>
    );
    bullets = [];
  };

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (line.startsWith("- ")) {
      bullets.push(line.slice(2));
      return;
    }

    flushBullets();
    if (!line) return;

    if (line.startsWith("## ")) {
      nodes.push(<h2 key={index} className="mt-9 font-display text-3xl md:text-4xl">{line.slice(3)}</h2>);
    } else if (line.startsWith("### ")) {
      nodes.push(<h3 key={index} className="mt-7 text-lg font-bold">{line.slice(4)}</h3>);
    } else if (/^Effective /i.test(line)) {
      nodes.push(<div key={index} className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{line}</div>);
    } else {
      nodes.push(<p key={index} className="mt-4 text-[15px] leading-7 text-foreground/85">{line}</p>);
    }
  });

  flushBullets();
  return nodes;
}

export default function PolicyPageContent({ page }) {
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 lg:px-8 md:py-16">
      <div className="rounded-2xl border border-border bg-card p-5 md:p-8">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          <ShieldCheck size={15} /> GDP Clothing policy
        </div>
        <h1 className="mt-3 font-display text-5xl leading-none md:text-7xl">{page.title}</h1>
        {page.excerpt && <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">{page.excerpt}</p>}

        <div className="mt-8 border-t border-border pt-1">
          {renderContent(page.body?.content)}
        </div>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6 text-sm">
          <Link to="/pages/contact" className="font-bold text-accent hover:underline">Contact GDP Clothing</Link>
          <Link to="/pages/privacy" className="text-muted-foreground hover:text-foreground">Privacy Policy</Link>
          <Link to="/pages/terms" className="text-muted-foreground hover:text-foreground">Terms & Conditions</Link>
        </div>
      </div>
    </article>
  );
}
