import { useCallback, useRef } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { LEASE_LOGS_SCOPE, useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { AssistantClientToolRequest, AssistantClientToolResult } from "@src/types/assistant";
import { isLeaseLive } from "@src/utils/leaseUtils";
import type { ConfigureFormRegistry } from "../configureFormRegistry/configureFormRegistry";
import { useConfigureFormRegistry } from "../configureFormRegistry/configureFormRegistry";
import { tailLinesOf } from "../transcriptModel/transcriptModel";

export const DEPENDENCIES = { useServices, useProviderCredentials, useConfigureFormRegistry };

class ClientToolRefusal extends Error {}

const NO_LIVE_LEASE = "The deployment has no active lease, so there is nothing to read.";
const PROVIDER_NOT_FOUND = "Couldn't find the provider running this deployment.";
const NO_ACCESS = "Couldn't get access to this deployment's logs and events.";
const PROVIDER_UNREACHABLE = "Couldn't reach the provider running this deployment.";
const NO_DEPLOYMENT = "No deployment was named, so there is nothing to read.";
const CONFIGURE_FORM_CLOSED = "The configure page is not open, so there is no form to read.";
const CONFIGURE_FORM_UNREADABLE = "Couldn't read the configure form.";

/** The API keeps only this much of a browser read, so a form read that would be cut drops its screening SDL first. */
const MAX_CONFIGURE_FORM_READ_LENGTH = 6_000;

/** Answers the assistant's `read_logs` and `read_events` through the same provider connection the Logs and Events tabs use, and `read_configure_form` from the open configure page. */
export function useAssistantClientTools(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const container = d.useServices();
  const containerRef = useRef(container);
  containerRef.current = container;
  const { ensureToken } = d.useProviderCredentials();
  const configureForms = d.useConfigureFormRegistry();

  const readOutput = useCallback(
    async (request: AssistantClientToolRequest): Promise<string> => {
      const { api, providerLookup, providerProxy } = containerRef.current;
      const { dseq, service } = request.arguments;
      if (!dseq) throw new ClientToolRefusal(NO_DEPLOYMENT);
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
      if (request.name === "read_configure_form") return readConfigureForm(configureForms, request);

      try {
        const output = await readOutput(request);
        return { toolCallId: request.toolCallId, ok: true, content: lastCharactersOf(output || "Nothing was returned.", request.maxLength) };
      } catch (error) {
        const reason = error instanceof ClientToolRefusal ? error.message : PROVIDER_UNREACHABLE;
        return { toolCallId: request.toolCallId, ok: false, content: reason.slice(0, request.maxLength) };
      }
    },
    [readOutput, configureForms]
  );
}

function readConfigureForm(configureForms: ConfigureFormRegistry, request: AssistantClientToolRequest): AssistantClientToolResult {
  const form = configureForms.current;
  if (!form) return { toolCallId: request.toolCallId, ok: false, content: CONFIGURE_FORM_CLOSED };

  try {
    const maxLength = Math.min(request.maxLength, MAX_CONFIGURE_FORM_READ_LENGTH);
    const read = form.read();
    const content = JSON.stringify(read);
    return { toolCallId: request.toolCallId, ok: true, content: content.length <= maxLength ? content : JSON.stringify({ ...read, screeningSdl: null }) };
  } catch {
    return { toolCallId: request.toolCallId, ok: false, content: CONFIGURE_FORM_UNREADABLE };
  }
}

/** The newest lines say the most about what is going wrong, so a long read keeps its end. */
function lastCharactersOf(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(text.length - maxLength) : text;
}
