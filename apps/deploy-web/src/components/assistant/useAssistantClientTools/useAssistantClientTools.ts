import { useCallback, useRef } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { LEASE_LOGS_SCOPE, useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { AssistantClientToolRequest, AssistantClientToolResult } from "@src/types/assistant";
import { isLeaseLive } from "@src/utils/leaseUtils";
import { tailLinesOf } from "../transcriptModel/transcriptModel";

export const DEPENDENCIES = { useServices, useProviderCredentials };

class ClientToolRefusal extends Error {}

const NO_LIVE_LEASE = "The deployment has no active lease, so there is nothing to read.";
const PROVIDER_NOT_FOUND = "Couldn't find the provider running this deployment.";
const NO_ACCESS = "Couldn't get access to this deployment's logs and events.";
const PROVIDER_UNREACHABLE = "Couldn't reach the provider running this deployment.";

/** Answers the assistant's `read_logs` and `read_events` from the browser, through the same provider connection the Logs and Events tabs use. */
export function useAssistantClientTools(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const container = d.useServices();
  const containerRef = useRef(container);
  containerRef.current = container;
  const { ensureToken } = d.useProviderCredentials();

  const readOutput = useCallback(
    async (request: AssistantClientToolRequest): Promise<string> => {
      const { api, providerLookup, providerProxy } = containerRef.current;
      const { dseq, service } = request.arguments;
      const { data: leases } = await api.v1.listLeases.queryOptions({ dseq }).queryFn();
      const liveLeases = leases.filter(isLeaseLive);
      if (liveLeases.length === 0) throw new ClientToolRefusal(NO_LIVE_LEASE);

      const outputs = await Promise.all(
        liveLeases.map(async ({ id }) => {
          const provider = await providerLookup.findByAddress(id.provider);
          if (!provider?.hostUri) throw new ClientToolRefusal(PROVIDER_NOT_FOUND);

          let isAccessRefused = false;
          const ensureLogsToken = async () => {
            try {
              return await ensureToken({ access: { provider: provider.owner, dseqs: [dseq], scope: LEASE_LOGS_SCOPE } });
            } catch (error) {
              isAccessRefused = true;
              throw error;
            }
          };

          const output = await providerProxy.readLogs({
            providerBaseUrl: provider.hostUri,
            providerAddress: provider.owner,
            ensureToken: ensureLogsToken,
            dseq,
            gseq: id.gseq,
            oseq: id.oseq,
            type: request.name === "read_logs" ? "logs" : "events",
            tail: tailLinesOf(request),
            services: service ? [service] : undefined
          });
          if (isAccessRefused) throw new ClientToolRefusal(NO_ACCESS);

          return output;
        })
      );

      return outputs.join("");
    },
    [ensureToken]
  );

  return useCallback(
    async (request: AssistantClientToolRequest): Promise<AssistantClientToolResult> => {
      try {
        const output = await readOutput(request);
        return { toolCallId: request.toolCallId, ok: true, content: lastCharactersOf(output || "Nothing was returned.", request.maxLength) };
      } catch (error) {
        const reason = error instanceof ClientToolRefusal ? error.message : PROVIDER_UNREACHABLE;
        return { toolCallId: request.toolCallId, ok: false, content: reason.slice(0, request.maxLength) };
      }
    },
    [readOutput]
  );
}

/** The newest lines say the most about what is going wrong, so a long read keeps its end. */
function lastCharactersOf(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}
