"use client";
import type { FC, ReactNode } from "react";
import { Card, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";
import { AI_AGENTS_DOCS_URL, AKASH_SKILL_INSTALL_COMMAND } from "@src/config/agent-setup.config";
import { CommandBlock } from "./CommandBlock";

export const AKT_INSTALL_GUIDE_URL = "https://akash.network/docs/developers/deployment/akt/installation/";
export const AKT_DOCS_URL = "https://akash.network/docs/developers/deployment/akt/";

export const API_KEY_USAGE_SCRIPT_LINES = [
  "# Authenticate every request with the x-api-key header",
  'export AKASH_API_KEY="<your-api-key>"',
  "API=https://console-api.akash.network",
  "",
  "# 1. Create a deployment from deploy.yaml. Your account credits fund it.",
  'DSEQ=$(curl -s -X POST "$API/v1/deployments" \\',
  '  -H "x-api-key: $AKASH_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d "$(jq -n --rawfile sdl deploy.yaml '{ data: { sdl: $sdl } }')" | jq -r '.data.dseq // empty')`,
  `[ -n "$DSEQ" ] || { echo "Couldn't create the deployment" >&2; exit 1; }`,
  "",
  "# 2. Wait for providers to bid",
  'until BID=$(curl -s "$API/v1/bids?dseq=$DSEQ" \\',
  `    -H "x-api-key: $AKASH_API_KEY" | jq -ce '.data[0].bid.id'); do`,
  "  sleep 3",
  "done",
  "",
  "# 3. Accept the first bid to start the lease",
  'curl -s -X POST "$API/v1/leases" \\',
  '  -H "x-api-key: $AKASH_API_KEY" \\',
  '  -H "Content-Type: application/json" \\',
  `  -d "$(jq -n --argjson bid "$BID" '{ leases: [$bid | { dseq, gseq, oseq, provider }] }')"`,
  "",
  "# 4. Close the deployment when you're done. Unspent funds go back to your account.",
  'curl -s -X DELETE "$API/v1/deployments/$DSEQ" \\',
  '  -H "x-api-key: $AKASH_API_KEY"'
];

export const ApiKeyUsageGuide: FC = () => (
  <SettingsSection title="Using your keys">
    <Tabs defaultValue="agent">
      <TabsList>
        <TabsTrigger value="agent">Agent</TabsTrigger>
        <TabsTrigger value="akt">akt CLI</TabsTrigger>
        <TabsTrigger value="rest">REST API</TabsTrigger>
      </TabsList>

      <Card className="mt-3 rounded-xl p-5 shadow-none sm:p-6">
        <TabsContent value="agent" className="mt-0">
          <ol className="flex flex-col gap-6">
            <SetupStep index={1} title="Install the Akash skill" description="From your terminal. Works with Claude Code, Cursor, Codex, OpenCode and more.">
              <CommandBlock label="skill install command" lines={[AKASH_SKILL_INSTALL_COMMAND]} />
            </SetupStep>
            <SetupStep index={2} title="Give your agent the key" description="Set it in the shell your agent runs in. The skill reads it from AKASH_API_KEY.">
              <CommandBlock label="API key export" lines={['export AKASH_API_KEY="<your-api-key>"']} />
            </SetupStep>
            <SetupStep
              index={3}
              title="Ask it to deploy"
              description={
                <>
                  Describe what to run, for example &ldquo;Deploy nginx on Akash&rdquo;. The{" "}
                  <ExternalTextLink href={AI_AGENTS_DOCS_URL}>setup guide</ExternalTextLink> covers each agent.
                </>
              }
            />
          </ol>
        </TabsContent>

        <TabsContent value="akt" className="mt-0">
          <ol className="flex flex-col gap-6">
            <SetupStep
              index={1}
              title="Install akt"
              description={
                <>
                  With Homebrew on macOS or Linux. The <ExternalTextLink href={AKT_INSTALL_GUIDE_URL}>installation guide</ExternalTextLink> covers other
                  platforms.
                </>
              }
            >
              <CommandBlock label="akt install command" lines={["brew install akash-network/tap/akt"]} />
            </SetupStep>
            <SetupStep
              index={2}
              title="Connect it to your account"
              description="Creates a context that deploys through Console, then asks for your key and stores it."
            >
              <CommandBlock label="akt login commands" lines={["akt context create console --deploy-via console --set-current", "akt console login"]} />
            </SetupStep>
            <SetupStep
              index={3}
              title="Deploy"
              description={
                <>
                  Scaffolds an SDL, then creates the deployment, waits for bids and starts the lease. The{" "}
                  <ExternalTextLink href={AKT_DOCS_URL}>akt docs</ExternalTextLink> cover every command.
                </>
              }
            >
              <CommandBlock label="akt deploy commands" lines={["akt sdl init web > deploy.yaml", "akt deploy deploy.yaml"]} />
            </SetupStep>
          </ol>
        </TabsContent>

        <TabsContent value="rest" className="mt-0 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Send the key in the x-api-key header. Save this script next to deploy.yaml and run it with bash. It follows the getting-started flow: create a
            deployment, wait for bids, start the lease and close it.
          </p>
          <CommandBlock label="REST API script" lines={API_KEY_USAGE_SCRIPT_LINES} />
        </TabsContent>
      </Card>
    </Tabs>
  </SettingsSection>
);

type SetupStepProps = {
  index: number;
  title: string;
  description: ReactNode;
  children?: ReactNode;
};

const SetupStep: FC<SetupStepProps> = ({ index, title, description, children }) => (
  <li className="flex gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground" aria-hidden>
      {index}
    </span>
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <h3 className="text-sm font-semibold leading-6">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  </li>
);

const ExternalTextLink: FC<{ href: string; children: ReactNode }> = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-4">
    {children}
  </a>
);
