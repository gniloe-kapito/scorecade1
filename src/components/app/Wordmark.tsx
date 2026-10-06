import { Gamepad2 } from "lucide-react";
import { SITE_NAME } from "@/lib/config";

export function Wordmark() {
  const first = SITE_NAME.slice(0, 5).toUpperCase();
  const rest = SITE_NAME.slice(5).toUpperCase();
  return (
    <>
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/15 text-primary"
      >
        <Gamepad2 className="h-[18px] w-[18px]" />
      </span>
      <span className="text-lg font-extrabold tracking-tight">
        {first}
        <span className="text-primary">{rest}</span>
      </span>
      <span className="sr-only">{SITE_NAME}</span>
    </>
  );
}
