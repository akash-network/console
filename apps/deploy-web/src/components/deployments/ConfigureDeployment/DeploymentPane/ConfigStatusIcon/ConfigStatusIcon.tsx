import type { FC } from "react";
import { CheckCircleSolid } from "iconoir-react";

/** Configuration progress of a service or placement. `partial` only occurs for placements. */
export type ConfigStatus = "incomplete" | "partial" | "complete";

type Props = {
  status: ConfigStatus;
};

/**
 * Status marker: a green check when complete, a dashed ring with a centered dot
 * while partially complete, and an empty dashed ring while incomplete.
 */
export const ConfigStatusIcon: FC<Props> = ({ status }) => {
  if (status === "complete") {
    return (
      <span role="img" aria-label="Complete" className="shrink-0 text-green-600">
        <CheckCircleSolid className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === "partial") {
    return (
      <span
        role="img"
        aria-label="Partial"
        className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground"
      >
        <span className="h-1 w-1 rounded-full bg-muted-foreground" />
      </span>
    );
  }
  return <span role="img" aria-label="Incomplete" className="block h-3.5 w-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground" />;
};
