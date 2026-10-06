"use client";

import dynamic from "next/dynamic";

// Scorecade is a hash-routed SPA (#/game/steam:730) — it renders fully on the
// client, exactly like the original GitHub Pages design. SSR is disabled to
// keep window/localStorage access safe.
const ClientApp = dynamic(() => import("./client-app"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3" aria-label="Загрузка Scorecade">
        <span className="flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 text-2xl font-extrabold text-primary">
          S
        </span>
        <span className="text-sm font-semibold text-muted-foreground">
          Загрузка…
        </span>
      </div>
    </div>
  ),
});

export default function Page() {
  return <ClientApp />;
}
