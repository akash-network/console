"use client";
import type { MouseEventHandler } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Star, StarSolid } from "iconoir-react";

export type FavoriteButtonProps = {
  onClick: MouseEventHandler;
  isFavorite: boolean;
};

export const FavoriteButton = ({ onClick, isFavorite }: FavoriteButtonProps) => {
  return (
    <Button onClick={onClick} size="icon" className="h-8 w-8 rounded-full" variant="ghost">
      {isFavorite ? <StarSolid className="text-xs text-primary" /> : <Star className="text-xs text-muted-foreground" />}
    </Button>
  );
};
