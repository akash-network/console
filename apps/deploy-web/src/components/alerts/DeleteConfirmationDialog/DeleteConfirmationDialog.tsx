import type { FC, ReactNode } from "react";
import React from "react";
import {
  Alert,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton
} from "@akashnetwork/ui/components";
import { Trash2 } from "lucide-react";

type Props = {
  title: string;
  description: ReactNode;
  refusal?: ReactNode;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const DeleteConfirmationDialog: FC<Props> = ({ title, description, refusal, isDeleting, onConfirm, onCancel }) => {
  return (
    <DialogV2 open onOpenChange={isOpen => !isOpen && !isDeleting && onCancel()}>
      <DialogV2Content className="max-w-[420px]">
        <DialogV2Header>
          <DialogV2Title>{title}</DialogV2Title>
          <DialogV2Description>{description}</DialogV2Description>
        </DialogV2Header>
        {refusal && (
          <DialogV2Body>
            <Alert variant="warning">{refusal}</Alert>
          </DialogV2Body>
        )}
        <DialogV2Footer>
          <Button type="button" variant="ghost" disabled={isDeleting} onClick={onCancel}>
            {refusal ? "OK" : "Cancel"}
          </Button>
          {!refusal && (
            <LoadingButton type="button" variant="destructive" loading={isDeleting} onClick={onConfirm} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </LoadingButton>
          )}
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
