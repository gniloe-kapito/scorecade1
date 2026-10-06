"use client";

import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

/** Floating "back to top" button shown after scrolling down 500px. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Наверх"
      className="fixed bottom-24 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-lg backdrop-blur-md transition-all hover:border-primary/50 hover:text-primary active:scale-95 md:bottom-6"
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
