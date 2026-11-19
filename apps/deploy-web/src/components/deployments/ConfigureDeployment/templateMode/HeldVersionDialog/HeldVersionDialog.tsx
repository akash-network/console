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
import { Clock } from "lucide-react";

import type { TemplateVersionDetail } from "@src/types/marketplace-template";

export interface HeldVersionDialogProps {
  version: Pick<TemplateVersionDetail, "version" | "holdReasons">;
  /** The version that stays in use while this one waits, whether the template is public at the moment or not. */
  currentVersion: number | undefined;
  onKeepEditing: () => void;
  onViewVersions: () => void;
}

export const HeldVersionDialog: FC<HeldVersionDialogProps> = ({ version, currentVersion, onKeepEditing, onViewVersions }) => {
  const reasons = version.holdReasons ?? [];

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen ? onKeepEditing() : undefined)}>
      <DialogV2Content className="max-w-xl">
        <DialogV2Header>
          <DialogV2Title>v{version.version} is saved and waiting for review</DialogV2Title>
          <DialogV2Description>
            Akash staff review this version before it becomes the current one.{" "}
            {currentVersion === undefined ? "Until then nobody deploys it." : `Until then v${currentVersion} stays the current version, the one people deploy.`}
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Body className="flex flex-col gap-4">
          {reasons.length > 0 ? (
            <section aria-labelledby="held-version-reasons">
              <h3 id="held-version-reasons" className="text-sm font-semibold">
                Why it waits for review
              </h3>
              <ul aria-labelledby="held-version-reasons" className="mt-2 divide-y divide-border rounded-xl border border-border bg-card">
                {reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2.5 px-4 py-3 text-sm">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden="true" />
                    <span className="min-w-0 break-words">{reason.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">The Versions tab of the template shows why it waits.</p>
          )}
          <p className="text-[13px] text-muted-foreground">
            You get an email and a notice in Console when staff approve or reject it. There is nothing more to do until then.
          </p>
        </DialogV2Body>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onKeepEditing}>
            Keep editing
          </Button>
          <Button type="button" onClick={onViewVersions}>
            View versions
          </Button>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};
