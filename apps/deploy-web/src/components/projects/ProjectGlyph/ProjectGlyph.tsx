import { cn } from "@akashnetwork/ui/utils";

const RADIUS_RATIO = 0.26;
const LETTER_RATIO = 0.44;

interface Props {
  name: string;
  size?: number;
  className?: string;
}

/** A project's first letter in a rounded square, the mark the project switcher and picker rows share. */
export function ProjectGlyph({ name, size = 28, className }: Props) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-border bg-muted font-mono font-semibold leading-none text-foreground",
        className
      )}
      style={{ width: size, height: size, borderRadius: Math.round(size * RADIUS_RATIO), fontSize: Math.round(size * LETTER_RATIO) }}
    >
      {(name.charAt(0) || "?").toUpperCase()}
    </span>
  );
}
