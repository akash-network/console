import type { FC, FormEvent, ReactNode } from "react";
import { useId, useState } from "react";
import {
  Button,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Label,
  LoadingButton
} from "@akashnetwork/ui/components";
import { ArrowLeftIcon, BoxIcon, CheckIcon, LockIcon, MessageCircleQuestionIcon, TriangleAlertIcon } from "lucide-react";

import { LengthCounter } from "@src/components/shared/LengthCounter/LengthCounter";
import type { ServiceType } from "@src/types";
import type { TemplateAskedValue } from "@src/types/marketplace-template";
import type { UnaskableSecret } from "../buildAskedValues";
import { countOf, summarizeTemplateServices } from "../templateServicesSummary";
import { UnaskableSecretsAlert } from "../UnaskableSecretsAlert/UnaskableSecretsAlert";

const TITLE_MAX_LENGTH = 80;
const SUMMARY_MAX_LENGTH = 200;

export type TemplateDetails = { title: string; summary: string };

type Props = {
  open: boolean;
  /** The name in the editor, which the title restarts from each time the dialog opens. */
  initialTitle?: string;
  /** Whether that name is the deployment's the template is saved from. */
  isTitleFromDeployment?: boolean;
  /** The summary suggested for the template, which the dialog starts from and Cancel goes back to. */
  initialSummary?: string;
  projectName?: string;
  /** The deployment the template is saved from. */
  sourceName?: string;
  askedValues: TemplateAskedValue[];
  savedAsIs: string[];
  /** The keys of plain values that look like a key, saved as they are unless made secret. */
  lookalikeKeys: string[];
  unaskableSecrets: UnaskableSecret[];
  services: ServiceType[];
  isSaving: boolean;
  onSave: (details: TemplateDetails) => void;
  onClose: () => void;
};

/** Stays mounted while closed, so going back to the configuration keeps the summary and only Cancel forgets it. */
export const SaveTemplateDialog: FC<Props> = ({
  open,
  initialTitle = "",
  isTitleFromDeployment = false,
  initialSummary = "",
  projectName,
  sourceName,
  askedValues,
  savedAsIs,
  lookalikeKeys,
  unaskableSecrets,
  services,
  isSaving,
  onSave,
  onClose
}) => {
  const formId = useId();
  const titleCounterId = useId();
  const summaryId = useId();
  const summaryCounterId = useId();
  const [title, setTitle] = useState(initialTitle);
  const [summary, setSummary] = useState(initialSummary);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setTitle(initialTitle);
  }
  const canSave = title.trim() !== "" && unaskableSecrets.length === 0 && !isSaving;

  const cancel = () => {
    setSummary(initialSummary);
    onClose();
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (canSave) onSave({ title: title.trim(), summary: summary.trim() });
  };

  return (
    <DialogV2 open={open} onOpenChange={isOpen => (!isOpen && !isSaving ? onClose() : undefined)}>
      <DialogV2Content className="max-w-2xl" hideCloseButton={isSaving}>
        <DialogV2Header>
          <DialogV2Title>Save template</DialogV2Title>
          <DialogV2Description>Only the title is needed. You can change everything later on the template page.</DialogV2Description>
        </DialogV2Header>
        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-5" onSubmit={save}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <Label htmlFor={`${formId}-title`}>Title</Label>
                {isTitleFromDeployment && initialTitle && title === initialTitle && (
                  <span className="text-xs text-muted-foreground">From the deployment name</span>
                )}
              </div>
              <input
                id={`${formId}-title`}
                autoComplete="off"
                maxLength={TITLE_MAX_LENGTH}
                aria-describedby={titleCounterId}
                value={title}
                onChange={event => setTitle(event.target.value)}
                className={FIELD_CLASSES}
              />
              <div className="flex justify-end">
                <LengthCounter id={titleCounterId} length={title.length} max={TITLE_MAX_LENGTH} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={summaryId}>
                Summary <span className="font-normal text-muted-foreground">Optional</span>
              </Label>
              <textarea
                id={summaryId}
                rows={3}
                maxLength={SUMMARY_MAX_LENGTH}
                aria-describedby={summaryCounterId}
                value={summary}
                onChange={event => setSummary(event.target.value)}
                className={`${FIELD_CLASSES} resize-y`}
              />
              <div className="flex justify-end">
                <LengthCounter id={summaryCounterId} length={summary.length} max={SUMMARY_MAX_LENGTH} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {projectName ? `Saved as Private in ${projectName}.` : "Saved as Private."} Make it available to your organization from the template page.
            </p>
            <UnaskableSecretsAlert unaskableSecrets={unaskableSecrets} />
            <TemplateRecap askedValues={askedValues} savedAsIs={savedAsIs} lookalikeKeys={lookalikeKeys} services={services} sourceName={sourceName} />
          </form>
        </DialogV2Body>
        <DialogV2Footer className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" className="gap-2" disabled={isSaving} onClick={onClose}>
            <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
            Back to configuration
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={cancel}>
              Cancel
            </Button>
            <LoadingButton type="submit" form={formId} loading={isSaving} disabled={!canSave}>
              Save template
            </LoadingButton>
          </div>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

const FIELD_CLASSES =
  "w-full rounded-md border border-input bg-popover px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type RecapProps = Pick<Props, "askedValues" | "savedAsIs" | "lookalikeKeys" | "services" | "sourceName">;

const TemplateRecap: FC<RecapProps> = ({ askedValues, savedAsIs, lookalikeKeys, services, sourceName }) => {
  const recapId = useId();
  const secretKeys = askedValues.filter(value => value.type === "secret").map(value => value.key);
  const { names, serviceCount, resources } = summarizeTemplateServices(services);

  return (
    <section className="rounded-lg border border-border bg-muted/40 px-4 py-3">
      <h3 id={recapId} className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Recap
      </h3>
      <ul aria-labelledby={recapId} className="mt-2 divide-y divide-border">
        {askedValues.length > 0 && (
          <RecapRow
            icon={<MessageCircleQuestionIcon className="h-4 w-4" />}
            title={`${countOf(askedValues.length, "value", "values")} asked to the deployer`}
            detail={askedValues.map(value => value.label).join(", ")}
          />
        )}
        {secretKeys.length > 0 && (
          <RecapRow
            icon={<LockIcon className="h-4 w-4 text-blue-600" />}
            title={countOf(secretKeys.length, "secret", "secrets")}
            detail={secretKeys.length === 1 ? `Your value for ${secretKeys[0]} isn't saved.` : `Your values for ${listInProse(secretKeys)} aren't saved.`}
          />
        )}
        {lookalikeKeys.length > 0 && (
          <RecapRow
            icon={<TriangleAlertIcon className="h-4 w-4 text-amber-600" />}
            title={
              lookalikeKeys.length === 1
                ? "1 value looks like a key and will be saved as is"
                : `${lookalikeKeys.length} values look like keys and will be saved as is`
            }
            detail={lookalikeKeys.join(", ")}
          />
        )}
        {savedAsIs.length > 0 && (
          <RecapRow
            icon={<CheckIcon className="h-4 w-4 text-green-600" />}
            title={`${countOf(savedAsIs.length, "value", "values")} saved as is`}
            detail={savedAsIs.join(", ")}
          />
        )}
        <RecapRow
          icon={<BoxIcon className="h-4 w-4" />}
          title={sourceName ? `${serviceCount} from ${sourceName}` : serviceCount}
          detail={`${names.join(", ")} · ${resources}`}
        />
      </ul>
    </section>
  );
};

const RecapRow: FC<{ icon: ReactNode; title: string; detail: string }> = ({ icon, title, detail }) => (
  <li className="flex gap-3 py-2.5">
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      {icon}
    </span>
    <div className="flex min-w-0 flex-col">
      <span className="text-sm font-medium">{title}</span>
      <span className="break-words text-sm text-muted-foreground">{detail}</span>
    </div>
  </li>
);

function listInProse(items: string[]): string {
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
