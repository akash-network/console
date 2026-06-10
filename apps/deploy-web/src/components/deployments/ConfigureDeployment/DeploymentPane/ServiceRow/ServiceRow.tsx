import type { FC, MouseEvent } from "react";
import { InlineEditInput } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { CheckCircleSolid, Trash } from "iconoir-react";

import type { ServiceType } from "@src/types";
import { useServiceStatus } from "../useServiceStatus/useServiceStatus";

export const DEPENDENCIES = { InlineEditInput, useServiceStatus };

type Props = {
  service: ServiceType;
  serviceIndex: number;
  isSelected: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ServiceRow: FC<Props> = ({ service, serviceIndex, isSelected, canRemove, onSelect, onRemove, dependencies: d = DEPENDENCIES }) => {
  const isConfigured = d.useServiceStatus(serviceIndex);

  function removeWithoutSelecting(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRemove();
  }

  return (
    <li
      onClick={onSelect}
      className={cn("group flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2", {
        "border-foreground": isSelected,
        "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600": !isSelected
      })}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={`Select ${service.title}`}
        className="flex h-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ServiceStatusIcon isConfigured={isConfigured} />
      </button>
      <d.InlineEditInput name={`services.${serviceIndex}.title`} label="Service name" />
      {canRemove && (
        <button
          type="button"
          aria-label={`Remove ${service.title}`}
          onClick={removeWithoutSelecting}
          className="invisible flex h-5 shrink-0 items-center text-muted-foreground group-hover:visible hover:text-foreground focus-visible:visible"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
};

/** Green check when every validation rule passes; dashed circle while incomplete. */
function ServiceStatusIcon({ isConfigured }: { isConfigured: boolean }) {
  if (isConfigured) {
    return (
      <span role="img" aria-label="Configured" className="shrink-0 text-green-600">
        <CheckCircleSolid className="h-3.5 w-3.5" />
      </span>
    );
  }
  return <span role="img" aria-label="Incomplete" className="block h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground" />;
}
