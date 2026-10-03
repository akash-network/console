"use client";
import type { FC } from "react";
import type { ApiKeyResponse } from "@akashnetwork/http-sdk";
import {
  Button,
  DialogV2,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  LoadingButton
} from "@akashnetwork/ui/components";

type Props = {
  apiKey: ApiKeyResponse;
  isRevoking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export const RevokeApiKeyDialog: FC<Props> = ({ apiKey, isRevoking, onConfirm, onCancel }) => (
  <DialogV2 open onOpenChange={isOpen => (!isOpen && !isRevoking ? onCancel() : undefined)}>
    <DialogV2Content className="max-w-md" hideCloseButton={isRevoking}>
      <DialogV2Header>
        <DialogV2Title>Revoke &ldquo;{apiKey.name}&rdquo;?</DialogV2Title>
        <DialogV2Description>Any client still using this key starts getting 401 Unauthorized right away. This can&apos;t be undone.</DialogV2Description>
      </DialogV2Header>
      <DialogV2Footer className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" disabled={isRevoking} onClick={onCancel}>
          Cancel
        </Button>
        <LoadingButton type="button" variant="destructive" loading={isRevoking} onClick={onConfirm}>
          Revoke key
        </LoadingButton>
      </DialogV2Footer>
    </DialogV2Content>
  </DialogV2>
);
