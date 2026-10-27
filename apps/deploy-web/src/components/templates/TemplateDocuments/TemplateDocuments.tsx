"use client";

import type { FC, ReactNode } from "react";
import type { PluggableList } from "react-markdown/lib/react-markdown";
import { GithubLogo, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import { BookOpen, FileCode, FileText } from "lucide-react";

import { SDLEditor } from "@src/components/sdl/SDLEditor/SDLEditor";
import Markdown from "@src/components/shared/Markdown";
import type { ApiTemplate } from "@src/types";
import { rehypeRemoveDeployBadge } from "../rehypeRemoveDeployBadge/rehypeRemoveDeployBadge";
import { describeRepository } from "../templateRepository";

const MARKDOWN_CLASSES =
  "prose-sm [overflow-wrap:anywhere] prose-headings:tracking-tight prose-h1:border-b prose-h1:border-border prose-h1:pb-3 prose-h1:text-[22px] prose-h2:text-base prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-pre:rounded-[10px] dark:prose-a:text-blue-400 [&_img]:max-w-full";

const TEMPLATE_DOCUMENT_PLUGINS: PluggableList = [rehypeRemoveDeployBadge];

export const DEPENDENCIES = {
  Markdown,
  SDLEditor
};

export interface TemplateDocumentsProps {
  template: Pick<ApiTemplate, "id" | "readme" | "deploy" | "guide" | "githubUrl">;
  /** Left off where the SDL that runs is a deployment's own rather than the template's. */
  showsSdl?: boolean;
  className?: string;
  dependencies?: typeof DEPENDENCIES;
}

export const TemplateDocuments: FC<TemplateDocumentsProps> = ({ template, showsSdl = false, className, dependencies: d = DEPENDENCIES }) => {
  const repository = describeRepository(template.githubUrl);

  return (
    <Tabs defaultValue="readme" className={cn("min-w-0 overflow-hidden border-y border-border bg-card shadow-sm sm:rounded-[14px] sm:border-x", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-foreground/[0.03] px-3 py-1.5 sm:px-[18px]">
        <TabsList aria-label="Template files" className="h-auto flex-wrap gap-0.5 bg-transparent p-0">
          <FileTab value="readme" icon={FileText}>
            README.md
          </FileTab>
          {showsSdl && (
            <FileTab value="sdl" icon={FileCode}>
              deploy.yaml
            </FileTab>
          )}
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
        <d.Markdown hasHtml={template.id?.startsWith("akash-network-awesome-akash")} className={MARKDOWN_CLASSES} rehypePlugins={TEMPLATE_DOCUMENT_PLUGINS}>
          {template.readme}
        </d.Markdown>
      </TabsContent>
      {showsSdl && (
        <TabsContent value="sdl" className="mt-0 h-[70vh] min-h-[420px] sm:p-3">
          <d.SDLEditor height="100%" value={template.deploy || ""} readonly />
        </TabsContent>
      )}
      {template.guide && (
        <TabsContent value="guide" className="mt-0 px-4 pb-[26px] pt-[22px] sm:px-[26px]">
          <d.Markdown className={MARKDOWN_CLASSES} rehypePlugins={TEMPLATE_DOCUMENT_PLUGINS}>
            {template.guide}
          </d.Markdown>
        </TabsContent>
      )}
    </Tabs>
  );
};

const FileTab: FC<{ value: string; icon: LucideIcon; children: ReactNode }> = ({ value, icon: Icon, children }) => (
  <TabsTrigger
    value={value}
    className="gap-1.5 rounded-md px-2.5 py-1.5 font-mono text-[11px] font-normal text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground hover:text-foreground"
  >
    <Icon className="h-[13px] w-[13px] opacity-60" aria-hidden="true" />
    {children}
  </TabsTrigger>
);
