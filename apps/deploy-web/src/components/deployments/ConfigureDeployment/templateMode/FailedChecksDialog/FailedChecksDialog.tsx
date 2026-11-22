"use client";
import type { FC, RefObject } from "react";
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
import type { PublishCheckFix, PublishFixLinks } from "@src/components/templates/publishing/publishReadiness";
import { failedPublishChecksOf, PUBLISH_CHECK_FIX_LABELS } from "@src/components/templates/publishing/publishReadiness";
import type { TemplateVersionDetail } from "@src/types/marketplace-template";

export interface FailedChecksDialogProps {
  version: Pick<TemplateVersionDetail, "version" | "checkResults">;
  liveVersion: number | undefined;
  /** Where each fix that is made outside Configure lives; the configuration itself is fixed on the page behind the dialog. */
  fixLinks: PublishFixLinks;
  onFollowFix: (href: string) => void;
  onKeepEditing: () => void;
  /** The dialog opens from a save with no trigger of its own, so closing hands focus back to the control that saved. */
  returnFocusTo: RefObject<HTMLElement | null>;
  onViewVersions: () => void;
}

const FIXED_ON_THIS_PAGE: PublishCheckFix = "edit-configuration";

export const FailedChecksDialog: FC<FailedChecksDialogProps> = ({
  version,
  liveVersion,
  fixLinks,
  onFollowFix,
  onKeepEditing,
  returnFocusTo,
  onViewVersions
}) => {
  const failedChecks = failedPublishChecksOf(version.checkResults?.checks ?? []);

  const renderFix = (fix: PublishCheckFix) => {
    const href = fixLinks[fix];
    if (!href || fix === FIXED_ON_THIS_PAGE) return null;

    return (
      <Button type="button" variant="outline" size="sm" onClick={() => onFollowFix(href)}>
        {PUBLISH_CHECK_FIX_LABELS[fix]}
      </Button>
    );
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onKeepEditing() : undefined)}>
      <DialogV2Content className="max-w-xl" onCloseAutoFocus={() => returnFocusTo.current?.focus()}>
        <DialogV2Header>
          <DialogV2Title>v{version.version} is saved, but it isn&apos;t live</DialogV2Title>
          <DialogV2Description>
            It didn&apos;t pass the publish checks of a public template
            {liveVersion === undefined ? "." : `, so people keep deploying v${liveVersion}.`} Fix what&apos;s listed here and save again.
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Body>
          {failedChecks.length > 0 ? (
            <PublishChecksList checks={failedChecks} renderFix={renderFix} />
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
