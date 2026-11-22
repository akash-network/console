"use client";
import type { FC, FormEvent } from "react";
import { useId, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  LoadingButton,
  Textarea
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Plus, Trash2 } from "lucide-react";

import type { PublisherLinkDraft } from "@src/components/templates/publisher/publisherProfileRules";
import {
  findPublisherProfileIssues,
  hasPublisherProfileIssues,
  MAX_PUBLISHER_BIO_LENGTH,
  MAX_PUBLISHER_LINKS,
  toPublisherProfileChange,
  toPublisherProfileDraft
} from "@src/components/templates/publisher/publisherProfileRules";
import { describePublisherProfileRefusal, readPublisherProfileRefusal } from "@src/components/templates/publisher/readPublisherProfileRefusal";
import { useUpdateTemplatePublisherMutation } from "@src/queries/useUserTemplateQueries";
import type { CurrentTemplatePublisher } from "@src/types/marketplace-template";

export const DEPENDENCIES = {
  useUpdateTemplatePublisherMutation
};

export interface EditPublisherProfileDialogProps {
  profile: Pick<CurrentTemplatePublisher, "name" | "bio" | "links">;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
}

const BLANK_LINK: PublisherLinkDraft = { url: "", label: "" };

export const EditPublisherProfileDialog: FC<EditPublisherProfileDialogProps> = ({ profile, onClose, dependencies: d = DEPENDENCIES }) => {
  const { mutateAsync: saveProfile, isPending: isSaving } = d.useUpdateTemplatePublisherMutation();
  const [draft, setDraft] = useState(() => toPublisherProfileDraft(profile));
  const [failure, setFailure] = useState<string>();
  const formId = useId();
  const bioIssueId = useId();
  const issues = findPublisherProfileIssues(draft);
  const bioLength = draft.bio.trim().length;

  const changeLink = (index: number, change: Partial<PublisherLinkDraft>) =>
    setDraft(current => ({ ...current, links: current.links.map((link, position) => (position === index ? { ...link, ...change } : link)) }));

  const removeLink = (index: number) => setDraft(current => ({ ...current, links: current.links.filter((_, position) => position !== index) }));

  const addLink = () => setDraft(current => ({ ...current, links: [...current.links, BLANK_LINK] }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving || hasPublisherProfileIssues(issues)) return;
    setFailure(undefined);

    try {
      await saveProfile({ data: toPublisherProfileChange(draft) });
      onClose();
    } catch (error) {
      setFailure(describePublisherProfileRefusal(readPublisherProfileRefusal(error)));
    }
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isSaving ? onClose() : undefined)}>
      <DialogV2Content className="max-w-xl" hideCloseButton={isSaving}>
        <DialogV2Header>
          <DialogV2Title>Edit publisher profile</DialogV2Title>
          <DialogV2Description className="break-words">
            Shown on the public page of {profile.name}. The name follows the organization and can&apos;t be changed here.
          </DialogV2Description>
        </DialogV2Header>

        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-6" onSubmit={save} noValidate>
            <div className="flex flex-col gap-1.5">
              <Textarea
                label="Bio"
                rows={4}
                inputClassName="min-h-24"
                disabled={isSaving}
                value={draft.bio}
                aria-invalid={!!issues.bio}
                aria-describedby={bioIssueId}
                onChange={event => setDraft(current => ({ ...current, bio: event.target.value }))}
              />
              <div id={bioIssueId} className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] text-muted-foreground">
                <p className={cn(issues.bio && "text-destructive")}>{issues.bio ?? "Plain text. Links and formatting are shown as written."}</p>
                <p
                  className={cn("ml-auto font-mono text-xs", issues.bio && "text-destructive")}
                  aria-label={`${bioLength} of ${MAX_PUBLISHER_BIO_LENGTH} characters used`}
                >
                  {bioLength} / {MAX_PUBLISHER_BIO_LENGTH}
                </p>
              </div>
            </div>

            <fieldset className="flex flex-col gap-3" disabled={isSaving}>
              <legend className="mb-2 flex w-full items-baseline justify-between gap-3 text-sm font-semibold">
                Links
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {draft.links.length} / {MAX_PUBLISHER_LINKS}
                </span>
              </legend>
              {draft.links.map((link, index) => (
                <LinkFields
                  key={index}
                  position={index + 1}
                  link={link}
                  issues={issues.links[index]}
                  onChange={change => changeLink(index, change)}
                  onRemove={() => removeLink(index)}
                />
              ))}
              {draft.links.length < MAX_PUBLISHER_LINKS && (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 self-start" onClick={addLink}>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add link
                </Button>
              )}
              <p className="text-[13px] text-muted-foreground">Only https links to public websites. Each link shows the site it opens next to its label.</p>
            </fieldset>

            {failure && (
              <Alert variant="destructive">
                <AlertDescription className="break-words">{failure}</AlertDescription>
              </Alert>
            )}
          </form>
        </DialogV2Body>

        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isSaving} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} loading={isSaving} disabled={isSaving || hasPublisherProfileIssues(issues)}>
            Save profile
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

const LinkFields: FC<{
  position: number;
  link: PublisherLinkDraft;
  issues: { url: string | undefined; label: string | undefined };
  onChange: (change: Partial<PublisherLinkDraft>) => void;
  onRemove: () => void;
}> = ({ position, link, issues, onChange, onRemove }) => {
  const issueId = useId();
  const issue = issues.url ?? issues.label;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end gap-2">
        <Input
          label={`Link ${position} address`}
          labelClassName="sr-only"
          type="url"
          inputMode="url"
          placeholder="https://example.org"
          className="min-w-[min(220px,100%)] flex-[2]"
          value={link.url}
          error={!!issues.url}
          aria-invalid={!!issues.url}
          aria-describedby={issue ? issueId : undefined}
          onChange={event => onChange({ url: event.target.value })}
        />
        <Input
          label={`Link ${position} label`}
          labelClassName="sr-only"
          type="text"
          placeholder="Label (optional)"
          className="min-w-[min(140px,100%)] flex-1"
          value={link.label}
          error={!!issues.label}
          aria-invalid={!!issues.label}
          aria-describedby={issue ? issueId : undefined}
          onChange={event => onChange({ label: event.target.value })}
        />
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${position}`} onClick={onRemove}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
      {issue && (
        <p id={issueId} className="text-[13px] text-destructive">
          {issue}
        </p>
      )}
    </div>
  );
};
