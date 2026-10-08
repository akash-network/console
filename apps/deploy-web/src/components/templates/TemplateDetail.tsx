"use client";

import type { FC, MouseEvent, ReactNode } from "react";
import { useId } from "react";
import type { PluggableList } from "react-markdown/lib/react-markdown";
import { Avatar, AvatarFallback, AvatarImage, buttonVariants, GithubLogo, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, BookOpen, FileCode, FileText, LayoutTemplate } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Markdown from "@src/components/shared/Markdown";
import { useHasInAppHistory } from "@src/hooks/useHasInAppHistory";
import type { ApiTemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../layout/Layout";
import { SDLEditor } from "../sdl/SDLEditor/SDLEditor";
import { rehypeRemoveDeployBadge } from "./rehypeRemoveDeployBadge/rehypeRemoveDeployBadge";
import { TemplateDeploysAs } from "./TemplateDeploysAs/TemplateDeploysAs";
import { describeRepository } from "./templateRepository";

const OVERLINE_CLASSES = "font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground";

const MARKDOWN_CLASSES =
  "prose-sm [overflow-wrap:anywhere] prose-headings:tracking-tight prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:text-[22px] prose-h2:text-base prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-pre:rounded-[10px] dark:prose-a:text-blue-400 [&_img]:max-w-full";

const TEMPLATE_DOCUMENT_PLUGINS: PluggableList = [rehypeRemoveDeployBadge];

export const DEPENDENCIES = {
  useRouter,
  useHasInAppHistory,
  Layout,
  Markdown,
  SDLEditor,
  TemplateDeploysAs
};

export interface TemplateDetailProps {
  template: ApiTemplate;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateDetail: FC<TemplateDetailProps> = ({ template, dependencies: d = DEPENDENCIES }) => {
  const router = d.useRouter();
  const hasInAppHistory = d.useHasInAppHistory();
  const beforeYouDeployId = useId();
  const repository = describeRepository(template.githubUrl);

  const returnToPreviousPage = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!hasInAppHistory || isOpeningElsewhere(event)) return;
    event.preventDefault();
    router.back();
  };

  return (
    <d.Layout background="dots" disableContainer>
      <div className="container px-4 pb-16 pt-6 sm:px-6">
        <Link
          href={UrlService.templates()}
          onClick={returnToPreviousPage}
          className="mb-[18px] inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-[13px] w-[13px]" aria-hidden="true" />
          Back to templates
        </Link>

        <header className="flex flex-wrap items-start gap-x-6 gap-y-4 border-b border-border pb-[22px]">
          <div className="min-w-[min(280px,100%)] flex-1">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-[34px] w-[34px] shrink-0 rounded-[9px] border border-border bg-muted">
                <AvatarImage src={template.logoUrl} alt="" className="object-contain p-1" />
                <AvatarFallback className="rounded-[9px] bg-muted">
                  <LayoutTemplate className="h-[17px] w-[17px]" aria-hidden="true" />
                </AvatarFallback>
              </Avatar>
              <h1 className="min-w-0 break-words text-[26px] font-bold leading-tight tracking-tight">{template.name}</h1>
            </div>
          </div>

          <Link
            href={UrlService.configureDeployment({ templateId: template.id })}
            className={cn(buttonVariants(), "shrink-0 gap-2 rounded-[10px] font-semibold")}
          >
            Deploy template
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        <div className="mt-[22px] grid items-start gap-5 min-[1080px]:grid-cols-[minmax(0,1fr)_300px]">
          <Tabs defaultValue="readme" className="-mx-4 min-w-0 overflow-hidden border-y border-border bg-card shadow-sm sm:mx-0 sm:rounded-[14px] sm:border-x">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-foreground/[0.03] px-3 py-1.5 sm:px-[18px]">
              <TabsList aria-label="Template files" className="h-auto flex-wrap gap-0.5 bg-transparent p-0">
                <FileTab value="readme" icon={FileText}>
                  README.md
                </FileTab>
                <FileTab value="sdl" icon={FileCode}>
                  deploy.yaml
                </FileTab>
                {template.guide && (
                  <FileTab value="guide" icon={BookOpen}>
                    GUIDE.md
                  </FileTab>
                )}
              </TabsList>

              {repository && (
                <a
                  href={template.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  <GithubLogo className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">View the source on GitHub: </span>
                  <span className="truncate">{repository}</span>
                </a>
              )}
            </div>

            <TabsContent value="readme" className="mt-0 px-4 pb-[26px] pt-[22px] sm:px-[26px]">
              <d.Markdown
                hasHtml={template.id?.startsWith("akash-network-awesome-akash")}
                className={MARKDOWN_CLASSES}
                rehypePlugins={TEMPLATE_DOCUMENT_PLUGINS}
              >
                {template.readme}
              </d.Markdown>
            </TabsContent>
            <TabsContent value="sdl" className="mt-0 h-[70vh] min-h-[420px] sm:p-3">
              <d.SDLEditor height="100%" value={template.deploy || ""} readonly />
            </TabsContent>
            {template.guide && (
              <TabsContent value="guide" className="mt-0 px-4 pb-[26px] pt-[22px] sm:px-[26px]">
                <d.Markdown className={MARKDOWN_CLASSES} rehypePlugins={TEMPLATE_DOCUMENT_PLUGINS}>
                  {template.guide}
                </d.Markdown>
              </TabsContent>
            )}
          </Tabs>

          <aside className="flex min-w-0 flex-col gap-3.5">
            <d.TemplateDeploysAs sdl={template.deploy} />

            <section aria-labelledby={beforeYouDeployId} className="rounded-[14px] border border-border bg-card px-4 py-3.5 shadow-sm">
              <h2 id={beforeYouDeployId} className={cn(OVERLINE_CLASSES, "pb-2")}>
                Before you deploy
              </h2>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Deploy template opens Configure with this template&apos;s image, ports and hardware filled in. You can change them there, and nothing runs until
                you pick a provider and deploy.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </d.Layout>
  );
};

/** Modifier clicks ask the browser to open the gallery in a new tab or window, which going back in this one would override. */
function isOpeningElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

const FileTab: FC<{ value: string; icon: LucideIcon; children: ReactNode }> = ({ value, icon: Icon, children }) => (
  <TabsTrigger
    value={value}
    className="gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-normal text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground hover:text-foreground"
  >
    <Icon className="h-[13px] w-[13px] opacity-60" aria-hidden="true" />
    {children}
  </TabsTrigger>
);
