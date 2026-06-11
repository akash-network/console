import type { FC } from "react";
import { Button, InlineEditInput } from "@akashnetwork/ui/components";
import { Globe, Trash } from "iconoir-react";

import type { EndpointType } from "@src/types";

export const DEPENDENCIES = { InlineEditInput };

type Props = {
  endpoint: EndpointType;
  endpointIndex: number;
  onRemove: () => void;
  dependencies?: typeof DEPENDENCIES;
};

export const EndpointRow: FC<Props> = ({ endpoint, endpointIndex, onRemove, dependencies: d = DEPENDENCIES }) => {
  return (
    <li className="group flex items-start gap-2 rounded-md border border-zinc-300 px-2.5 py-2 dark:border-zinc-700">
      <span className="flex h-5 shrink-0 items-center text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
      </span>
      <d.InlineEditInput name={`endpoints.${endpointIndex}.name`} label="Endpoint name" />
      <Button
        type="button"
        variant="text"
        aria-label={`Remove ${endpoint.name}`}
        onClick={onRemove}
        className="invisible h-5 shrink-0 p-0 text-muted-foreground group-hover:visible hover:text-foreground focus-visible:visible"
      >
        <Trash className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
};
