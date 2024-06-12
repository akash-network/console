"use client";
import { Star, StarSolid } from "iconoir-react";

import { Button } from "@akashnetwork/ui/components";

export const FavoriteButton = ({ onClick, isFavorite }) => {
  return (
    <Button onClick={onClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
      {isFavorite ? <StarSolid className="text-xs text-primary" /> : <Star className="text-xs text-muted-foreground" />}
    </Button>
  );
};
