import type { FC, ReactNode } from "react";

import { SettingsSection } from "@src/components/layout/SettingsSection/SettingsSection";

const CONSOLE_API_URL = "https://console-api.akash.network";

const Comment: FC<{ children: ReactNode }> = ({ children }) => <span className="text-zinc-500">{children}</span>;
const Command: FC<{ children: ReactNode }> = ({ children }) => <span className="text-emerald-400">{children}</span>;
const Value: FC<{ children: ReactNode }> = ({ children }) => <span className="text-red-300">{children}</span>;

export const ApiKeyUsageExample: FC = () => (
  <SettingsSection title="Using your keys">
    <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#0A0A0A] px-[18px] py-4 font-mono text-xs leading-relaxed text-zinc-300">
      <code>
        <Comment># Authenticate every request with the x-api-key header</Comment>
        {"\n"}export AKASH_API_KEY=<Value>&quot;&lt;your-api-key&gt;&quot;</Value>
        {"\n\n"}
        <Comment># List your deployments</Comment>
        {"\n"}
        <Command>curl</Command> {CONSOLE_API_URL}/v1/deployments \{"\n"}
        {"  "}-H <Value>&quot;x-api-key: $AKASH_API_KEY&quot;</Value>
        {"\n\n"}
        <Comment># Create a deployment from an SDL, funded from your account credits</Comment>
        {"\n"}
        <Command>curl</Command> -X POST {CONSOLE_API_URL}/v1/deployments \{"\n"}
        {"  "}-H <Value>&quot;x-api-key: $AKASH_API_KEY&quot;</Value> -H <Value>&quot;Content-Type: application/json&quot;</Value> \{"\n"}
        {"  "}-d <Value>&apos;{`{ "data": { "sdl": "<SDL_YAML>" } }`}&apos;</Value>
      </code>
    </pre>
  </SettingsSection>
);
