import { SITE_NAME } from "@/lib/config";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-card/40">
      {/* Single thin line: site · Steam attribution · year.
          pb keeps the fixed mobile bottom nav from covering the text. */}
      <div className="mx-auto w-full max-w-[900px] px-4 pb-[calc(env(safe-area-inset-bottom)+68px)] pt-2.5 text-center md:pb-3">
        <p className="text-[10px] leading-snug text-muted-foreground/80">
          <span className="font-extrabold tracking-wide text-muted-foreground">
            {SITE_NAME.toUpperCase()}
          </span>{" "}
          · Данные об играх — Steam. Проект не связан с Valve · Некоммерческий
          проект · {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
}
