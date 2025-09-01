import type { FC } from "react";
import * as React from "react";
import { Input } from "@akashnetwork/ui/components";
import { z } from "zod";

import { useSdlEnv } from "@src/hooks/useSdlEnv/useSdlEnv";

export const datadogEnvSchema = z.object({
  DD_API_KEY: z.string({ message: "Datadog API key is required." }).min(1, { message: "Datadog API key is required." }).trim(),
  DD_SITE: z.string({ message: "Datadog site is required." }).min(1, { message: "Datadog site key is required." }).trim()
});

type Props = {
  serviceIndex: number;
  dependencies?: {
    useSdlEnv: typeof useSdlEnv;
  };
};

export const DatadogEnvConfig: FC<Props> = ({ serviceIndex, dependencies: d = { useSdlEnv } }) => {
  const env = d.useSdlEnv({ serviceIndex, schema: datadogEnvSchema });

  return (
    <>
      <div className="mt-4">
        <Input
          value={env.getValue("DD_SITE")}
          onChange={e => env.setValue("DD_SITE", e.target.value)}
          type="text"
          label="Regional URL"
          className="w-full"
          placeholder="Example: app.datadoghq.com"
          error={!!env.errors.DD_SITE}
        />
        {env.errors.DD_SITE && <p className="mt-2 text-xs font-medium text-destructive">{env.errors.DD_SITE}</p>}
      </div>

      <div className="mt-4">
        <Input
          value={env.getValue("DD_API_KEY")}
          onChange={e => env.setValue("DD_API_KEY", e.target.value)}
          type="password"
          label="API Key"
          className="w-full"
          placeholder="Paste your API key here"
          error={!!env.errors.DD_API_KEY}
        />
        {env.errors.DD_API_KEY && <p className="mt-2 text-xs font-medium text-destructive">{env.errors.DD_API_KEY}</p>}
      </div>
    </>
  );
};
