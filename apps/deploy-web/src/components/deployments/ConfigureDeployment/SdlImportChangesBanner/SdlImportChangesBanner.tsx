import type { FC } from "react";
import { useId } from "react";
import { WarningCircle } from "iconoir-react";
import { XIcon } from "lucide-react";

interface Props {
  changes: string[];
  onDismiss: () => void;
}

/** The deployment is created from the form, so whatever an imported SDL asks for that the form cannot hold is named before anyone deploys without it. */
export const SdlImportChangesBanner: FC<Props> = ({ changes, onDismiss }) => {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex shrink-0 items-start gap-3 border-b border-warning/50 bg-warning/10 px-4 py-3">
      <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id={titleId} className="text-sm font-medium">
          Parts of the imported SDL won't deploy as written
        </h2>
        <p className="text-sm text-muted-foreground">This page can't hold them, so deploying from here changes the deployment:</p>
        <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm text-muted-foreground">
          {changes.map(change => (
            <li key={change}>{change}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </section>
  );
};
