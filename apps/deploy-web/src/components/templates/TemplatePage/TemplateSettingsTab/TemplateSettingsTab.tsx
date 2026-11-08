"use client";
import type { ChangeEvent, FC, FormEvent } from "react";
import { useId, useState } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Input,
  Label,
  LoadingButton,
  RadioGroup,
  RadioGroupItem,
  Snackbar
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useRouter } from "next/router";
import { useSnackbar } from "notistack";

import { LengthCounter } from "@src/components/shared/LengthCounter/LengthCounter";
import { describeTemplateRefusal } from "@src/components/templates/describeTemplateRefusal";
import { MAX_TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_OPTIONS } from "@src/components/templates/templateCatalog";
import { TEMPLATE_ICONS, TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import { VISIBILITY_LABELS } from "@src/components/templates/TemplateVisibilityBadge/TemplateVisibilityBadge";
import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useProjectsQuery } from "@src/queries/useProjectsQuery";
import { useDeleteMarketplaceTemplateMutation, useUpdateTemplateSettingsMutation } from "@src/queries/useUserTemplateQueries";
import type { MarketplaceTemplate, TemplateCategory, TemplateIconId } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  TemplateIcon,
  useUpdateTemplateSettingsMutation,
  useDeleteMarketplaceTemplateMutation,
  useActiveOrganization,
  useProjectsQuery,
  useSnackbar,
  useRouter
};

const TITLE_MAX_LENGTH = 80;
const SUMMARY_MAX_LENGTH = 200;
const DEFAULT_ICON: TemplateIconId = "box";
const ICON_IDS = Object.keys(TEMPLATE_ICONS) as TemplateIconId[];

type SettableVisibility = "private" | "organization";

type Edits = { title?: string; summary?: string; icon?: TemplateIconId | null; categories?: TemplateCategory[]; visibility?: SettableVisibility };

type Changes = {
  title?: string;
  summary?: string | null;
  icon?: TemplateIconId | null;
  categories?: TemplateCategory[];
  visibility?: SettableVisibility;
};

const SETTABLE_VISIBILITIES: readonly SettableVisibility[] = ["private", "organization"];

const SECTION_CLASSES = "rounded-[14px] border border-border bg-card p-4 shadow-sm sm:p-6";

export interface TemplateSettingsTabProps {
  template: MarketplaceTemplate;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateSettingsTab: FC<TemplateSettingsTabProps> = ({ template, dependencies: d = DEPENDENCIES }) => {
  const { mutateAsync: updateSettings, isPending: isSaving } = d.useUpdateTemplateSettingsMutation();
  const { activeOrganization, projectsEnabled } = d.useActiveOrganization();
  const { data: projects } = d.useProjectsQuery({ enabled: projectsEnabled });
  const { enqueueSnackbar } = d.useSnackbar();
  const [edits, setEdits] = useState<Edits>({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const titleCounterId = useId();
  const summaryId = useId();
  const summaryCounterId = useId();
  const iconLegendId = useId();

  const title = edits.title ?? template.title;
  const summary = edits.summary ?? template.summary ?? "";
  const icon = edits.icon === undefined ? findKnownIcon(template.icon) : edits.icon;
  const categories = edits.categories ?? findKnownCategories(template.categories);
  const titleLength = title.trim().length;
  const summaryLength = summary.trim().length;
  const projectName = projects?.find(project => project.id === template.projectId)?.name ?? "its project";
  const organizationName = template.publisher?.name ?? activeOrganization?.name ?? "your organization";
  const visibilityValue = edits.visibility ?? (template.visibility === "public" ? "" : template.visibility);
  const changes = findChanges(template, { title, summary, icon, categories, visibility: edits.visibility });
  const isTitleValid = changes.title === undefined || (titleLength > 0 && titleLength <= TITLE_MAX_LENGTH);
  const isSummaryValid = changes.summary === undefined || summaryLength <= SUMMARY_MAX_LENGTH;
  const canSave = Object.keys(changes).length > 0 && isTitleValid && isSummaryValid && !isSaving;
  const isAtCategoryLimit = categories.length >= MAX_TEMPLATE_CATEGORIES;

  const edit = (change: Edits) => setEdits(current => ({ ...current, ...change }));

  const toggleCategory = (category: TemplateCategory, isChecked: boolean) => {
    edit({ categories: isChecked ? [...categories, category] : categories.filter(candidate => candidate !== category) });
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    try {
      await updateSettings({ id: template.id, data: changes });
      setEdits({});
      enqueueSnackbar(<Snackbar title="Settings saved" iconVariant="success" />, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Couldn't save the settings" subTitle={describeFailure(error, "change")} iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <form className={cn(SECTION_CLASSES, "flex flex-col gap-6")} onSubmit={saveSettings}>
        <div className="flex flex-col gap-1.5">
          <Input
            label="Title"
            autoComplete="off"
            required
            aria-describedby={titleCounterId}
            value={title}
            onChange={event => edit({ title: event.target.value })}
          />
          <div className="flex justify-end">
            <LengthCounter id={titleCounterId} length={titleLength} max={TITLE_MAX_LENGTH} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={summaryId}>Summary</Label>
          <textarea
            id={summaryId}
            aria-describedby={summaryCounterId}
            rows={3}
            value={summary}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => edit({ summary: event.target.value })}
            className="w-full resize-y rounded-md border border-input bg-popover px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex justify-end">
            <LengthCounter id={summaryCounterId} length={summaryLength} max={SUMMARY_MAX_LENGTH} />
          </div>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend id={iconLegendId} className="mb-2 text-sm font-medium">
            Icon
          </legend>
          <div role="radiogroup" aria-labelledby={iconLegendId} className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {ICON_IDS.map(iconId => (
              <label
                key={iconId}
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[10px] border border-border bg-muted transition-colors has-[:checked]:border-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring hover:bg-accent"
              >
                <input
                  type="radio"
                  name="template-icon"
                  aria-label={iconId}
                  value={iconId}
                  checked={(icon ?? DEFAULT_ICON) === iconId}
                  onChange={() => edit({ icon: iconId })}
                  className="sr-only"
                />
                <d.TemplateIcon icon={iconId} className="h-5 w-5" />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex w-full items-baseline justify-between text-sm font-medium">
            <span>Categories</span>
            <span className="text-xs font-normal text-muted-foreground">Pick up to {MAX_TEMPLATE_CATEGORIES}</span>
          </legend>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATE_CATEGORY_OPTIONS.map(category => {
              const isChecked = categories.includes(category);
              return (
                <CategoryOption
                  key={category}
                  category={category}
                  isChecked={isChecked}
                  isDisabled={!isChecked && isAtCategoryLimit}
                  onToggle={toggleCategory}
                />
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Who can use it</legend>
          <RadioGroup value={visibilityValue} onValueChange={value => edit({ visibility: value as SettableVisibility })} aria-label="Who can use it">
            {SETTABLE_VISIBILITIES.map(visibility => (
              <div key={visibility} className="flex items-start gap-3">
                <RadioGroupItem id={`visibility-${visibility}`} value={visibility} className="mt-0.5" />
                <Label htmlFor={`visibility-${visibility}`} className="flex cursor-pointer flex-col gap-0.5">
                  <span className="font-medium">{VISIBILITY_LABELS[visibility]}</span>
                  <span className="text-[13px] font-normal text-muted-foreground">
                    {visibility === "private" ? `Members of ${projectName} can deploy it.` : `Every member of ${organizationName} can deploy it.`}
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          {template.visibility === "public" && (
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{VISIBILITY_LABELS.public}</span> is the current state. Making it private or organization-only takes
              it off its public link.
            </p>
          )}
        </fieldset>

        <div className="flex justify-end">
          <LoadingButton type="submit" loading={isSaving} disabled={!canSave}>
            Save
          </LoadingButton>
        </div>
      </form>

      <section
        aria-labelledby="danger-zone"
        className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-destructive/50 p-4 sm:p-6"
      >
        <div>
          <h2 id="danger-zone" className="text-base font-semibold">
            Danger zone
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Deleting the template removes it and all its versions. Deployments made from it keep running.
          </p>
        </div>
        <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
          Delete template
        </Button>
      </section>

      {isDeleteOpen && <DeleteTemplateDialog template={template} onClose={() => setIsDeleteOpen(false)} dependencies={d} />}
    </div>
  );
};

const CategoryOption: FC<{
  category: TemplateCategory;
  isChecked: boolean;
  isDisabled: boolean;
  onToggle: (category: TemplateCategory, isChecked: boolean) => void;
}> = ({ category, isChecked, isDisabled, onToggle }) => {
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={isChecked} disabled={isDisabled} onCheckedChange={checked => onToggle(category, checked === true)} />
      <Label htmlFor={id} className={cn("text-sm font-normal", isDisabled ? "text-muted-foreground" : "cursor-pointer")}>
        {category}
      </Label>
    </div>
  );
};

const DeleteTemplateDialog: FC<{ template: MarketplaceTemplate; onClose: () => void; dependencies: typeof DEPENDENCIES }> = ({
  template,
  onClose,
  dependencies: d
}) => {
  const { mutateAsync: deleteTemplate, isPending: isDeleting } = d.useDeleteMarketplaceTemplateMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const router = d.useRouter();
  const formId = useId();
  const [typedTitle, setTypedTitle] = useState("");
  const [failure, setFailure] = useState<string>();
  const [isDeleted, setIsDeleted] = useState(false);
  const canDelete = normalizeSpaces(typedTitle) === normalizeSpaces(template.title) && !isDeleting && !isDeleted;

  const confirmDelete = async (event: FormEvent) => {
    event.preventDefault();
    if (!canDelete) return;

    try {
      await deleteTemplate({ id: template.id });
      setIsDeleted(true);
    } catch (error) {
      setFailure(describeFailure(error, "delete"));
      return;
    }
    enqueueSnackbar(<Snackbar title={`Deleted ${template.title}`} iconVariant="success" />, { variant: "success" });
    await router.push(UrlService.myTemplates());
  };

  return (
    <DialogV2 open onOpenChange={isOpen => (!isOpen && !isDeleting ? onClose() : undefined)}>
      <DialogV2Content className="max-w-lg" hideCloseButton={isDeleting}>
        <DialogV2Header>
          <DialogV2Title>Delete {template.title}?</DialogV2Title>
          <DialogV2Description>
            The template and all its versions are deleted for everyone who can use it. Deployments made from it keep running. This can&apos;t be undone.
          </DialogV2Description>
        </DialogV2Header>
        <DialogV2Body>
          <form id={formId} className="flex flex-col gap-4" onSubmit={confirmDelete}>
            <Input
              label={
                <>
                  Type <span className="font-semibold">{template.title}</span> to confirm
                </>
              }
              autoComplete="off"
              value={typedTitle}
              onChange={event => setTypedTitle(event.target.value)}
              disabled={isDeleting || isDeleted}
            />
            {failure && (
              <Alert variant="destructive">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}
          </form>
        </DialogV2Body>
        <DialogV2Footer className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={formId} variant="destructive" loading={isDeleting} disabled={!canDelete}>
            Delete template
          </LoadingButton>
        </DialogV2Footer>
      </DialogV2Content>
    </DialogV2>
  );
};

function normalizeSpaces(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function findKnownIcon(icon: string | null) {
  return ICON_IDS.find(iconId => iconId === icon) ?? null;
}

function findKnownCategories(categories: string[]) {
  return TEMPLATE_CATEGORY_OPTIONS.filter(category => categories.includes(category));
}

function findChanges(
  template: MarketplaceTemplate,
  form: { title: string; summary: string; icon: TemplateIconId | null; categories: TemplateCategory[]; visibility: SettableVisibility | undefined }
): Changes {
  const changes: Changes = {};
  if (form.title.trim() !== template.title) changes.title = form.title.trim();
  if (form.summary.trim() !== (template.summary ?? "").trim()) changes.summary = form.summary.trim() || null;
  if (form.icon !== findKnownIcon(template.icon)) changes.icon = form.icon;
  if (!isSameSet(form.categories, findKnownCategories(template.categories))) changes.categories = form.categories;
  if (form.visibility && form.visibility !== template.visibility) changes.visibility = form.visibility;
  return changes;
}

function isSameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every(item => right.includes(item));
}

function describeFailure(error: unknown, action: "change" | "delete") {
  const refusal = describeTemplateRefusal(error);
  if (refusal) return refusal;
  if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return `You can no longer ${action} this template.`;
  return "Try again in a moment.";
}
