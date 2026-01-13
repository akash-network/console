"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Button, Input, Snackbar, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { usePopup } from "@akashnetwork/ui/context";
import { Copy, ShareIos } from "iconoir-react";
import { useSnackbar } from "notistack";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import type { ServiceType } from "@src/types";
import { copyTextToClipboard } from "@src/utils/copyClipboard";
import { getBaseUrl, UrlService } from "@src/utils/urlUtils";

export const DEPENDENCIES = {
  usePopup,
  useSnackbar,
  getBaseUrl,
  copyTextToClipboard,
  Button,
  ShareIos
};

export type ShareDeployButtonProps = {
  services: ServiceType[] | undefined;
  dependencies?: typeof DEPENDENCIES;
};

interface ShareDeployButtonContentProps {
  deployButtonData: {
    deployUrl: string;
    markdownSnippet: string;
    htmlSnippet: string;
    buttonImageUrl: string;
  };
  copySnippet: (snippet: string) => void;
  dependencies: {
    Button: typeof Button;
    Input: typeof Input;
    Snackbar: typeof Snackbar;
    Tabs: typeof Tabs;
    TabsContent: typeof TabsContent;
    TabsList: typeof TabsList;
    TabsTrigger: typeof TabsTrigger;
    Copy: typeof Copy;
  };
}

const ShareDeployButtonContent: FC<ShareDeployButtonContentProps> = ({ deployButtonData, copySnippet, dependencies: d }) => {
  const [activeTab, setActiveTab] = useState("markdown");

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-2">
        <a href={deployButtonData.deployUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
          <img src="/images/deploy-with-akash-btn.svg" alt="Deploy on Akash" className="h-auto" />
        </a>
        <p className="text-xs text-muted-foreground">An example Deploy Button using the following snippets.</p>
      </div>

      <d.Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="mb-5 w-full">
          <d.TabsList className="m-0 flex h-auto max-w-[1304px] flex-1 items-center justify-start rounded-none border-0 border-l-0 border-r-0 border-t-0 bg-transparent p-0">
            <d.TabsTrigger
              value="markdown"
              className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
            >
              <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                <span
                  className={`text-sm font-normal leading-5 transition-colors ${activeTab === "markdown" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                >
                  Markdown
                </span>
              </div>
            </d.TabsTrigger>
            <d.TabsTrigger
              value="html"
              className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
            >
              <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                <span
                  className={`text-sm font-normal leading-5 transition-colors ${activeTab === "html" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                >
                  HTML
                </span>
              </div>
            </d.TabsTrigger>
            <d.TabsTrigger
              value="url"
              className="flex-1 cursor-pointer rounded-none border-0 border-b-2 border-l-0 border-r-0 border-t-0 border-b-transparent bg-transparent py-1.5 shadow-none transition-colors data-[state=active]:border-b-neutral-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none hover:bg-transparent focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 dark:data-[state=active]:border-b-neutral-100"
            >
              <div className="flex items-center justify-center gap-2 px-2.5 py-2">
                <span
                  className={`text-sm font-normal leading-5 transition-colors ${activeTab === "url" ? "text-neutral-950 dark:text-[var(--text-light)]" : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"}`}
                >
                  URL
                </span>
              </div>
            </d.TabsTrigger>
          </d.TabsList>
        </div>

        <d.TabsContent value="markdown" className="mt-0 space-y-2">
          <p className="text-center text-xs text-muted-foreground">A Markdown snippet that shows a linked Deploy Button.</p>
          <div className="flex w-full items-center gap-2">
            <d.Input
              type="text"
              value={deployButtonData.markdownSnippet}
              readOnly
              className="flex-grow"
              inputClassName="bg-muted font-mono text-xs"
              onFocus={e => e.target.select()}
            />
            <d.Button
              aria-label="copy"
              aria-haspopup="true"
              onClick={() => copySnippet(deployButtonData.markdownSnippet)}
              size="icon"
              variant="ghost"
              type="button"
            >
              <d.Copy />
            </d.Button>
          </div>
        </d.TabsContent>

        <d.TabsContent value="html" className="mt-0 space-y-2">
          <p className="text-center text-xs text-muted-foreground">A HTML snippet that shows a linked Deploy Button.</p>
          <div className="flex w-full items-center gap-2">
            <d.Input
              type="text"
              value={deployButtonData.htmlSnippet}
              readOnly
              className="flex-grow"
              inputClassName="bg-muted font-mono text-xs"
              onFocus={e => e.target.select()}
            />
            <d.Button
              aria-label="copy"
              aria-haspopup="true"
              onClick={() => copySnippet(deployButtonData.htmlSnippet)}
              size="icon"
              variant="ghost"
              type="button"
            >
              <d.Copy />
            </d.Button>
          </div>
        </d.TabsContent>

        <d.TabsContent value="url" className="mt-0 space-y-2">
          <p className="text-center text-xs text-muted-foreground">A Deploy Button source URL.</p>
          <div className="flex w-full items-center gap-2">
            <d.Input
              type="text"
              value={deployButtonData.deployUrl}
              readOnly
              className="flex-grow"
              inputClassName="bg-muted font-mono text-xs"
              onFocus={e => e.target.select()}
            />
            <d.Button aria-label="copy" aria-haspopup="true" onClick={() => copySnippet(deployButtonData.deployUrl)} size="icon" variant="ghost" type="button">
              <d.Copy />
            </d.Button>
          </div>
        </d.TabsContent>
      </d.Tabs>
    </div>
  );
};

export const ShareDeployButton: FC<ShareDeployButtonProps> = ({ services, dependencies: d = DEPENDENCIES }) => {
  const popup = d.usePopup();
  const snackbar = d.useSnackbar();

  const isPublicRepo = useMemo(() => {
    if (!services || services.length === 0) {
      return false;
    }
    return services[0]?.env?.some(e => e.key === protectedEnvironmentVariables.REPO_URL && e.value?.startsWith("https://")) ?? false;
  }, [services]);

  const deployButtonData = useMemo(() => {
    if (!services || services.length === 0) {
      return null;
    }

    const envVars = services[0]?.env || [];
    const getEnvValue = (key: string): string | null => {
      const envVar = envVars.find(e => e.key === key);
      return envVar?.value || null;
    };

    const repoUrl = getEnvValue(protectedEnvironmentVariables.REPO_URL);
    const branch = getEnvValue(protectedEnvironmentVariables.BRANCH_NAME);
    const buildCommand = getEnvValue(protectedEnvironmentVariables.BUILD_COMMAND);
    const startCommand = getEnvValue(protectedEnvironmentVariables.CUSTOM_SRC);
    const installCommand = getEnvValue(protectedEnvironmentVariables.INSTALL_COMMAND);
    const buildDirectory = getEnvValue(protectedEnvironmentVariables.BUILD_DIRECTORY);
    const nodeVersion = getEnvValue(protectedEnvironmentVariables.NODE_VERSION);

    if (!repoUrl) {
      return null;
    }

    const urlParams: Record<string, string> = {
      repoUrl
    };

    if (branch) urlParams.branch = branch;
    if (buildCommand) urlParams.buildCommand = buildCommand;
    if (startCommand) urlParams.startCommand = startCommand;
    if (installCommand) urlParams.installCommand = installCommand;
    if (buildDirectory) urlParams.buildDirectory = buildDirectory;
    if (nodeVersion) urlParams.nodeVersion = nodeVersion;

    const deployUrl = `${d.getBaseUrl()}${UrlService.newDeployment(urlParams)}`;
    const buttonImageUrl = "https://raw.githubusercontent.com/akash-network/support/main/deploy-with-akash-btn.svg";
    const markdownSnippet = `[![Deploy on Akash](${buttonImageUrl})](${deployUrl})`;
    const htmlSnippet = `<a href="${deployUrl}"><img src="${buttonImageUrl}" alt="Deploy on Akash"></a>`;

    return {
      deployUrl,
      markdownSnippet,
      htmlSnippet,
      buttonImageUrl,
      repoUrl
    };
  }, [services, d]);

  const copySnippet = (snippet: string) => {
    d.copyTextToClipboard(snippet);
    snackbar.enqueueSnackbar(<Snackbar title="Copied to clipboard!" iconVariant="success" />, { variant: "success", autoHideDuration: 1500 });
  };

  const openShareModal = () => {
    popup.createCustom({
      title: "Share Deploy Button",
      maxWidth: "md",
      enableCloseOnBackdropClick: true,
      fullWidth: true,
      actions: ({ close }) => [
        {
          label: "Close",
          color: "primary",
          side: "right",
          onClick: close
        }
      ],
      message: (
        <div className="max-h-[70vh] space-y-6 overflow-y-auto overflow-x-hidden px-1 pb-2">
          {deployButtonData && (
            <ShareDeployButtonContent
              deployButtonData={deployButtonData}
              copySnippet={copySnippet}
              dependencies={{
                Button,
                Input,
                Snackbar,
                Tabs,
                TabsContent,
                TabsList,
                TabsTrigger,
                Copy
              }}
            />
          )}
        </div>
      )
    });
  };

  return isPublicRepo ? (
    <d.Button variant="outline" onClick={openShareModal} aria-label="Share deploy button">
      <d.ShareIos className="h-4 w-4" />
    </d.Button>
  ) : null;
};
