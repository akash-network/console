"use client";
import type { ChangeEvent, FC } from "react";
import { useId, useState } from "react";
import { ApiError } from "@akashnetwork/openapi-sdk";
import { Alert, AlertDescription, Button, Label, LoadingButton, Snackbar, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { Pencil } from "lucide-react";
import { useSnackbar } from "notistack";

import { LengthCounter } from "@src/components/shared/LengthCounter/LengthCounter";
import Markdown from "@src/components/shared/Markdown";
import { useCreateTemplateVersionMutation } from "@src/queries/useUserTemplateQueries";
import type { TemplateVersionDetail } from "@src/types/marketplace-template";

export const DEPENDENCIES = {
  Markdown,
  useCreateTemplateVersionMutation,
  useSnackbar
};

const README_MAX_LENGTH = 50_000;

const MARKDOWN_CLASSES =
  "prose-sm [overflow-wrap:anywhere] prose-headings:tracking-tight prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:text-[22px] prose-h2:text-base prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-pre:rounded-[10px] dark:prose-a:text-blue-400 [&_img]:max-w-full";

export interface TemplateReadmeTabProps {
  templateId: string;
  version: TemplateVersionDetail;
  canEdit: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateReadmeTab: FC<TemplateReadmeTabProps> = ({ templateId, version, canEdit, dependencies: d = DEPENDENCIES }) => {
  const { mutateAsync: createVersion, isPending: isSaving } = d.useCreateTemplateVersionMutation();
  const { enqueueSnackbar } = d.useSnackbar();
  const [draft, setDraft] = useState<string | null>(null);
  const [hasNewerVersion, setHasNewerVersion] = useState(false);
  const editorId = useId();
  const counterId = useId();

  const closeEditor = () => {
    setDraft(null);
    setHasNewerVersion(false);
  };

  const saveReadme = async (readme: string) => {
    try {
      await createVersion({
        id: templateId,
        data: { sdl: version.sdl, askedValues: version.askedValues, readme: readme.trim() ? readme : null, baseVersion: version.version }
      });
      closeEditor();
      enqueueSnackbar(<Snackbar title="README saved as a new version" iconVariant="success" />, { variant: "success" });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setHasNewerVersion(true);
        return;
      }
      enqueueSnackbar(<Snackbar title="Couldn't save the README" subTitle="Try again in a moment." iconVariant="error" />, { variant: "error" });
    }
  };

  if (draft === null) {
    return (
      <section className="relative rounded-[14px] border border-border bg-card px-4 pb-[26px] pt-[22px] shadow-sm sm:px-[26px]">
        {canEdit && (
          <Button variant="outline" size="sm" className="float-right ml-4 gap-1.5" onClick={() => setDraft(version.readme ?? "")}>
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit README
          </Button>
        )}
        {version.readme ? (
          <d.Markdown className={MARKDOWN_CLASSES}>{version.readme}</d.Markdown>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No README yet</p>
        )}
      </section>
    );
  }

  const isTooLong = draft.length > README_MAX_LENGTH;

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-border bg-card p-4 shadow-sm sm:p-5">
      <Tabs defaultValue="write" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor={editorId} className="text-base font-semibold">
            README
          </Label>
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="write" className="mt-0">
          <textarea
            id={editorId}
            aria-describedby={counterId}
            value={draft}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setDraft(event.target.value)}
            className="min-h-[420px] w-full resize-y rounded-md border border-input bg-popover px-3 py-2 font-mono text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </TabsContent>
        <TabsContent value="preview" className="mt-0 min-h-[420px] rounded-md border border-border px-4 py-4 sm:px-6">
          {draft.trim() ? (
            <d.Markdown className={MARKDOWN_CLASSES}>{draft}</d.Markdown>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing to preview</p>
          )}
        </TabsContent>
      </Tabs>

      {hasNewerVersion && (
        <Alert variant="warning">
          <AlertDescription>Someone saved a newer version. Reload to see it.</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <LengthCounter id={counterId} length={draft.length} max={README_MAX_LENGTH} />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={closeEditor} disabled={isSaving}>
            Cancel
          </Button>
          <LoadingButton size="sm" loading={isSaving} disabled={isTooLong} onClick={() => saveReadme(draft)}>
            Save README
          </LoadingButton>
        </div>
      </div>
    </section>
  );
};
