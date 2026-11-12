"use client";
import { useId } from "react";
import { Sparkles } from "lucide-react";

type Props = {
  onClick: () => void;
};

const LABEL = "Ask the assistant";

export function AssistantLauncherButton({ onClick }: Props) {
  const gradientId = useId();

  return (
    <button
      type="button"
      onClick={onClick}
      title={LABEL}
      aria-label={LABEL}
      className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border bg-background bg-gradient-to-br from-violet-500/10 to-sky-500/10 transition-colors hover:from-violet-500/20 hover:to-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8b5cf6" />
            <stop offset="1" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
      </svg>
      <Sparkles stroke={`url(#${gradientId})`} className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
    </button>
  );
}
