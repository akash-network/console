import type { FC } from "react";

import { ImageCard } from "../ImageCard/ImageCard";

export const DEPENDENCIES = { ImageCard };

type Props = {
  serviceIndex: number;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * The "IMAGE" section of the Configuration pane for the selected service: the Docker image card,
 * pulled to the top of the column so the one required runtime field is the first thing a fresh
 * deployment shows.
 */
export const ImageSection: FC<Props> = ({ serviceIndex, dependencies: d = DEPENDENCIES }) => {
  return (
    <div className="flex flex-col gap-2 px-4">
      <p className="font-mono text-xs uppercase text-muted-foreground">Image</p>
      <div className="flex flex-col gap-4">
        <d.ImageCard serviceIndex={serviceIndex} />
      </div>
    </div>
  );
};
