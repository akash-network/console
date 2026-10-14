import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  rightSlot?: ReactNode;
}

/** The small mono overline that heads a section of the projects pages, with room for a count or action on the right. */
export function SectionLabel({ children, rightSlot }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3 pt-2">
      <span className="font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground">{children}</span>
      {rightSlot}
    </div>
  );
}
