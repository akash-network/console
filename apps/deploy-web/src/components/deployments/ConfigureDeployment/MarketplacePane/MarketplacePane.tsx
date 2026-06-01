import type { FC } from "react";

export const MarketplacePane: FC = () => {
  return (
    <section aria-labelledby="configure-marketplace-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="hidden h-[52px] shrink-0 items-center border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-marketplace-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          3. Compute Marketplace
        </h2>
      </header>
      <div className="flex-1 overflow-y-auto" />
    </section>
  );
};
