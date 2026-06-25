import type { FC, MouseEvent } from "react";
import { useId } from "react";
import { FieldErrorMessage, InlineEditInput, useFieldError } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Trash } from "iconoir-react";

import type { ServiceType } from "@src/types";
import { ConfigStatusIcon } from "../ConfigStatusIcon/ConfigStatusIcon";
import { useServiceStatus } from "../useServiceStatus/useServiceStatus";

export const DEPENDENCIES = { InlineEditInput, useFieldError, useServiceStatus };

type Props = {
  service: ServiceType;
  serviceIndex: number;
  isSelected: boolean;
  canRemove: boolean;
  /** While locked the row stays selectable, but the service name is disabled (clicks fall through to select it). */
  locked?: boolean;
  onSelect: () => void;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const ServiceRow: FC<Props> = ({ service, serviceIndex, isSelected, canRemove, locked = false, onSelect, onRemove, dependencies: d = DEPENDENCIES }) => {
  const isConfigured = d.useServiceStatus(serviceIndex);
  const { error } = d.useFieldError(`services.${serviceIndex}.title`);
  const errorId = useId();

  function removeWithoutSelecting(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onRemove();
  }

  function selectWithoutSelectingPlacement(event: MouseEvent<HTMLLIElement>) {
    event.stopPropagation();
    onSelect();
  }

  return (
    <li onClick={selectWithoutSelectingPlacement} className="group flex cursor-pointer flex-col gap-1">
      <div
        className={cn("flex items-start gap-2 rounded-md border px-2.5 py-2", {
          "border-destructive": !!error,
          "border-foreground bg-accent": isSelected && !error,
          "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600": !isSelected && !error
        })}
      >
        <button
          type="button"
          aria-pressed={isSelected}
          aria-label={`Select ${service.title}`}
          className="flex h-5 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ConfigStatusIcon status={isConfigured ? "complete" : "incomplete"} />
        </button>
        <fieldset disabled={locked} className="m-0 min-w-0 flex-1 border-0 p-0 disabled:pointer-events-none">
          <d.InlineEditInput name={`services.${serviceIndex}.title`} label="Service name" suppressErrorMessage errorMessageId={errorId} />
        </fieldset>
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
      </div>
      {error && <FieldErrorMessage id={errorId}>{error}</FieldErrorMessage>}
    </li>
  );
};
