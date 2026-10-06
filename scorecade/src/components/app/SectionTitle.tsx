import { cn } from "@/lib/utils";

/** Consistent section heading with a small neon accent bar. */
export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      <span
        aria-hidden
        className="h-4 w-1 shrink-0 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]"
      />
      {children}
    </h2>
  );
}
