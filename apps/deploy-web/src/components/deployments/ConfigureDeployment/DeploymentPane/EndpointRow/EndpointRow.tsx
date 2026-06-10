import type { FC } from "react";
import { useId } from "react";
import { Button, FieldErrorMessage, InlineEditInput, useFieldError } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Globe, Trash } from "iconoir-react";

import type { EndpointType } from "@src/types";

export const DEPENDENCIES = { InlineEditInput, useFieldError };

type Props = {
  endpoint: EndpointType;
  endpointIndex: number;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const EndpointRow: FC<Props> = ({ endpoint, endpointIndex, onRemove, dependencies: d = DEPENDENCIES }) => {
  const { error } = d.useFieldError(`endpoints.${endpointIndex}.name`);
  const errorId = useId();

  return (
    <li className="group flex flex-col gap-1">
      <div
        className={cn("flex items-start gap-2 rounded-md border border-zinc-300 px-2.5 py-2", {
          "border-destructive": !!error,
          "border-zinc-300 dark:border-zinc-700": !error
        })}
      >
        <span className="flex h-5 shrink-0 items-center text-muted-foreground">
          <Globe className="h-3.5 w-3.5" />
        </span>
        <d.InlineEditInput name={`endpoints.${endpointIndex}.name`} label="Endpoint name" suppressErrorMessage errorMessageId={errorId} />
        <Button
          type="button"
          variant="text"
          aria-label={`Remove ${endpoint.name}`}
          onClick={onRemove}
          className="invisible h-5 shrink-0 p-0 text-muted-foreground group-hover:visible hover:text-foreground focus-visible:visible"
        >
          <Trash className="h-3.5 w-3.5" />
        </Button>
      </div>
      {error && <FieldErrorMessage id={errorId}>{error}</FieldErrorMessage>}
    </li>
  );
};
