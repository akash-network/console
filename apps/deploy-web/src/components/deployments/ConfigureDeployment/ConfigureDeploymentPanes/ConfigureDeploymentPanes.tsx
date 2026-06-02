import type { FC } from "react";
import { useState } from "react";
import { cn } from "@akashnetwork/ui/utils";

import { ConfigurationPane } from "../ConfigurationPane/ConfigurationPane";
import { DeploymentPane } from "../DeploymentPane/DeploymentPane";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";

type ActivePane = "deployment" | "configuration" | "marketplace";

export const DEPENDENCIES = { DeploymentPane, ConfigurationPane, MarketplacePane };

type Props = {
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentPanes: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const [activePane, setActivePane] = useState<ActivePane>("deployment");

  return (
    <div className="flex h-full w-full flex-col">
      <div className="grid min-h-0 flex-1 grid-rows-1 md:grid-cols-[auto_320px_1fr] md:divide-x md:divide-zinc-300 md:border-t md:border-zinc-300 md:dark:divide-zinc-700 md:dark:border-zinc-700">
        <div className={cn("min-h-0 md:block", { hidden: activePane !== "deployment" })}>
          <d.DeploymentPane />
        </div>
        <div className={cn("min-h-0 md:block", { hidden: activePane !== "configuration" })}>
          <d.ConfigurationPane />
        </div>
        <div className={cn("min-h-0 md:block", { hidden: activePane !== "marketplace" })}>
          <d.MarketplacePane />
        </div>
      </div>

      <nav aria-label="Pane navigation" className="flex shrink-0 border-t border-zinc-300 md:hidden dark:border-zinc-700">
        <PaneTab label="1. Deployment" value="deployment" activeValue={activePane} onSelect={setActivePane} />
        <PaneTab label="2. Configuration" value="configuration" activeValue={activePane} onSelect={setActivePane} />
        <PaneTab label="3. Marketplace" value="marketplace" activeValue={activePane} onSelect={setActivePane} />
      </nav>
    </div>
  );
};

interface PaneTabProps {
  label: string;
  value: ActivePane;
  activeValue: ActivePane;
  onSelect: (value: ActivePane) => void;
}

function PaneTab({ label, value, activeValue, onSelect }: PaneTabProps) {
  const isActive = activeValue === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-current={isActive ? "page" : undefined}
      className={cn("flex-1 px-3 py-3 font-mono text-xs font-medium uppercase tracking-wide transition-colors", {
        "border-t-2 border-foreground text-foreground": isActive,
        "border-t-2 border-transparent text-muted-foreground": !isActive
      })}
    >
      {label}
    </button>
  );
}
