"use client";
import type { FC } from "react";
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

import { PublishChecksList } from "@src/components/templates/publishing/PublishChecksList/PublishChecksList";
import { failedPublishChecksOf } from "@src/components/templates/publishing/publishReadiness";
import type { TemplateVersionDetail } from "@src/types/marketplace-template";

export interface FailedChecksDialogProps {
  version: Pick<TemplateVersionDetail, "version" | "checkResults">;
  /** The version people keep deploying, when the template has one. */
  liveVersion: number | undefined;
  onKeepEditing: () => void;
  onViewVersions: () => void;
}

export const FailedChecksDialog: FC<FailedChecksDialogProps> = ({ version, liveVersion, onKeepEditing, onViewVersions }) => {
  const failedChecks = failedPublishChecksOf(version.checkResults?.checks ?? []);

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onKeepEditing() : undefined)}>
      <DialogV2Content className="max-w-xl">
        <DialogV2Header>
          <DialogV2Title>v{version.version} is saved, but it isn&apos;t live</DialogV2Title>
          <DialogV2Description>
            It didn&apos;t pass the publish checks of a public template
            {liveVersion === undefined ? "." : `, so people keep deploying v${liveVersion}.`} Fix what&apos;s listed here and save again.
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Body>
          {failedChecks.length > 0 ? (
            <PublishChecksList checks={failedChecks} />
          ) : (
            <p className="text-sm text-muted-foreground">The Versions tab of the template shows what failed.</p>
          )}
        </DialogV2Body>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onViewVersions}>
            View versions
          </Button>
          <Button type="button" onClick={onKeepEditing}>
            Keep editing
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
