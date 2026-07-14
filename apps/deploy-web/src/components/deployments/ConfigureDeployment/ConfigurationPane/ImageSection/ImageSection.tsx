import type { FC } from "react";

import { ImageCard } from "../ImageCard/ImageCard";

export const DEPENDENCIES = { ImageCard };

type Props = {
  serviceIndex: number;
  /** Locks the image card while a create/close/deploy is in flight; it stays editable while quoting (pushed as a manifest update). */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "IMAGE" section of the Configuration pane for the selected service: the Docker image card,
 * pulled to the top of the column so the one required runtime field is the first thing a fresh
 * deployment shows.
 */
export const ImageSection: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Image</p>
      <div className="flex flex-col gap-4">
        <d.ImageCard serviceIndex={serviceIndex} locked={locked} />
      </div>
    </div>
  );
};
