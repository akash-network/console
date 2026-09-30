import type { FC } from "react";
import { useMemo } from "react";
import { useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { listSpecIssueMessages } from "../useRequestQuotes/invalidFieldMessages";

/** Names what keeps providers from being listed, because the form marks a field only once it is touched or a submit is refused. */
export const InvalidSpecReasons: FC = () => {
  const values = useWatch<SdlBuilderFormValuesType>();
  const reasons = useMemo(() => listSpecIssueMessages(values as SdlBuilderFormValuesType), [values]);

  if (reasons.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Some settings on the left aren&apos;t valid yet. Check them to see which providers can host your deployment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
      <p>Fix these on the left to see which providers can host your deployment:</p>
      <ul aria-label="Settings to fix" className="list-disc pl-4">
        {reasons.map(reason => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </div>
  );
};
