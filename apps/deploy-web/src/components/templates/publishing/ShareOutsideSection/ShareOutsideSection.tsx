"use client";
import type { FC } from "react";
import { useId } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import { cn, copyTextToClipboard } from "@akashnetwork/ui/utils";
import { Copy, Link2 } from "lucide-react";
import { useSnackbar } from "notistack";

import { getBaseUrl, UrlService } from "@src/utils/urlUtils";
import { buildDeployBadge, DEPLOY_BADGE_ALT, DEPLOY_BADGE_IMAGE_PATH } from "../deployBadge";

export const DEPENDENCIES = { useSnackbar };

const SNIPPET_CLASSES =
  "block w-full resize-none rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export interface ShareOutsideSectionProps {
  templateId: string;
  /** The badge is offered only where a stranger's click lands on a page they can open. */
  hasBadge: boolean;
  dependencies?: typeof DEPENDENCIES;
}

export const ShareOutsideSection: FC<ShareOutsideSectionProps> = ({ templateId, hasBadge, dependencies: d = DEPENDENCIES }) => {
  const { enqueueSnackbar } = d.useSnackbar();
  const headingId = useId();
  const baseUrl = getBaseUrl();
  const link = `${baseUrl}${UrlService.template(templateId)}`;
  const badge = buildDeployBadge(baseUrl, templateId);

  const copy = async (text: string, copiedTitle: string) => {
    const isCopied = await copyTextToClipboard(text);
    if (isCopied) {
      enqueueSnackbar(<Snackbar title={copiedTitle} iconVariant="success" />, { variant: "success" });
    } else {
      enqueueSnackbar(<Snackbar title="Couldn't copy it" subTitle="Select the text and copy it yourself." iconVariant="error" />, { variant: "error" });
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="text-sm font-semibold">
        Share the link
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly aria-label="Template link" value={link} onFocus={event => event.target.select()} className={cn(SNIPPET_CLASSES, "min-w-0 flex-1")} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => copy(link, "Link copied")}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Copy link
        </Button>
      </div>

      {hasBadge && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Deploy on Akash badge</p>
              <p className="text-[13px] text-muted-foreground">Put it in a README or a blog post. It opens this template.</p>
            </div>
            <img src={DEPLOY_BADGE_IMAGE_PATH} alt={DEPLOY_BADGE_ALT} width={244} height={44} />
          </div>
          <BadgeSnippet label="Markdown" snippet={badge.markdown} onCopy={() => copy(badge.markdown, "Markdown copied")} />
          <BadgeSnippet label="HTML" snippet={badge.html} onCopy={() => copy(badge.html, "HTML copied")} />
        </div>
      )}
    </section>
  );
};

const BadgeSnippet: FC<{ label: string; snippet: string; onCopy: () => void }> = ({ label, snippet, onCopy }) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        Copy {label}
      </Button>
    </div>
    <textarea
      readOnly
      rows={2}
      aria-label={`${label} badge code`}
      value={snippet}
      onFocus={event => event.target.select()}
      className={cn(SNIPPET_CLASSES, "break-all")}
    />
  </div>
);
