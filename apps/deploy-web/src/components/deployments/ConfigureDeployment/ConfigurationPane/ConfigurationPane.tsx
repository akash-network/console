import type { FC } from "react";

export const ConfigurationPane: FC = () => {
  return (
    <section aria-labelledby="configure-configuration-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="hidden h-[52px] shrink-0 items-center gap-2 border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-configuration-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          2. Configuration
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto" />
    </section>
  );
};
