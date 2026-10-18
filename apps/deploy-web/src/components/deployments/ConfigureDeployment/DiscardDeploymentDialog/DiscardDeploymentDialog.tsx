"use client";
import type { FC, ReactNode } from "react";
import { useId } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title
} from "@akashnetwork/ui/components";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  keepLabel: string;
  discardLabel: string;
  onDiscard: () => void;
  children: ReactNode;
};

export const DiscardDeploymentDialog: FC<Props> = ({ open, onOpenChange, title, description, keepLabel, discardLabel, onDiscard, children }) => {
  const descriptionId = useId();

  return (
    <DialogV2 open={open} onOpenChange={onOpenChange}>
      <DialogV2Content className="max-w-md" aria-describedby={descriptionId}>
        <DialogV2Header>
          <DialogV2Title>{title}</DialogV2Title>
          <DialogV2Description id={descriptionId}>{description}</DialogV2Description>
        </DialogV2Header>
        <DialogV2Body className="flex flex-col gap-3">{children}</DialogV2Body>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {keepLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            {discardLabel}
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
