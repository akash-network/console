import type { FC } from "react";
import { useState } from "react";
import { SidebarCollapse, SidebarExpand } from "iconoir-react";

export const DeploymentPane: FC = () => {
  const [minimized, setMinimized] = useState(false);
  const toggle = () => setMinimized(prev => !prev);

  if (minimized) {
    return (
      <aside aria-label="Deployment pane (minimized)" className="hidden h-full min-h-0 md:flex md:w-[48px] md:flex-col md:items-center md:pt-2">
        <button
          type="button"
          onClick={toggle}
          aria-label="Show deployment pane"
          className="flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-accent"
        >
          <SidebarExpand className="h-5 w-5" />
        </button>
      </aside>
    );
  }

  return (
    <section aria-labelledby="configure-deployment-pane-heading" className="flex h-full min-h-0 flex-col md:w-[231px]">
      <header className="hidden h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-deployment-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          1. Deployment
        </h2>
        <button
          type="button"
          onClick={toggle}
          aria-label="Hide deployment pane"
          className="flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-accent"
        >
          <SidebarCollapse className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto" />
    </section>
  );
};
