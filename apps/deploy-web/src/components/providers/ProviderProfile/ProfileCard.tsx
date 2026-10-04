import type { FC, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@akashnetwork/ui/utils";

type ProfileCardProps = {
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const ProfileCard: FC<ProfileCardProps> = ({ title, aside, className, children }) => {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn("min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <div className="flex items-center gap-2 border-b px-3.5 py-3">
        <h2 id={headingId} className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </h2>
        <span className="flex-1" />
        {aside}
      </div>
      {children}
    </section>
  );
};

export const ProfileRow: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-3 border-t py-[6.5px] first:border-t-0">
    <dt className="whitespace-nowrap text-[11.5px] text-muted-foreground">{label}</dt>
    <dd className="min-w-0 truncate text-right font-mono text-[11.5px] text-foreground">{children}</dd>
  </div>
);
