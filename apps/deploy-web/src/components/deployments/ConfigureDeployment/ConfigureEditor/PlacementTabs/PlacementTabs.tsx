import type { FC, ReactNode } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { PlusIcon, TrashIcon } from "lucide-react";

import type { ConfigStatus } from "../../DeploymentPane/ConfigStatusIcon/ConfigStatusIcon";
import { ConfigStatusIcon } from "../../DeploymentPane/ConfigStatusIcon/ConfigStatusIcon";

export interface PlacementTab {
  id: string;
  name: string;
  status: ConfigStatus;
  hasError: boolean;
}

type Props = {
  placements: PlacementTab[];
  activePlacementId: string;
  onSelectPlacement: (placementId: string) => void;
  canRemove: boolean;
  onRemovePlacement: (placementId: string) => void;
  onAddPlacement: () => void;
  locked?: boolean;
  children: ReactNode;
};

/** Manual activation, because switching placements with the arrow keys would mount every service editor it passes over. */
export const PlacementTabs: FC<Props> = ({
  placements,
  activePlacementId,
  onSelectPlacement,
  canRemove,
  onRemovePlacement,
  onAddPlacement,
  locked = false,
  children
}) => {
  const activePlacement = placements.find(placement => placement.id === activePlacementId);

  return (
    <Tabs value={activePlacementId} onValueChange={onSelectPlacement} activationMode="manual" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList aria-label="Placements" className="h-auto flex-wrap">
          {placements.map(placement => (
            <TabsTrigger key={placement.id} value={placement.id} className={cn("gap-2 px-3", placement.hasError && "text-destructive")}>
              <ConfigStatusIcon status={placement.status} />
              {placement.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {canRemove && !locked && activePlacement && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${activePlacement.name}`}
            onClick={() => onRemovePlacement(activePlacement.id)}
            className="h-8 w-8 text-muted-foreground"
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" disabled={locked} onClick={onAddPlacement} className="gap-1.5">
          <PlusIcon className="h-4 w-4" />
          Add placement
        </Button>
      </div>
      <TabsContent value={activePlacementId} className="mt-0">
        {children}
      </TabsContent>
    </Tabs>
  );
};
