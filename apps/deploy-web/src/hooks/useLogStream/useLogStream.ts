import { useCallback, useEffect, useRef, useState } from "react";

import { useServices } from "@src/context/ServicesProvider";
import { useThrottledCallback } from "@src/hooks/useThrottle";
import { formatK8sEvent, formatLogMessage } from "@src/services/provider-proxy/logFormatters";
import type { K8sEventMessage, LogEntryMessage, ProviderProxyMessage } from "@src/services/provider-proxy/provider-proxy.service";
import { forEachGeneratedItem } from "@src/utils/array";

export type LOGS_MODE = "logs" | "events";

export type LogStreamStatus = "idle" | "connecting" | "silent" | "streaming" | "closed";

/** A provider with nothing to send holds the socket open indefinitely, so silence this long after authenticating is the only signal that there is nothing to show. */
export const SILENT_STREAM_TIMEOUT_MS = 10_000;

const FLUSH_INTERVAL_MS = 1000;

type UseLogStreamInput = {
  mode: LOGS_MODE;
  enabled: boolean;
  providerBaseUrl: string | undefined;
  providerAddress: string | undefined;
  ensureToken: () => Promise<string>;
  dseq: string | undefined;
  gseq: number | undefined;
  oseq: number | undefined;
  services: string[];
  selectedServices: string[];
};

export function useLogStream({
  mode,
  enabled,
  providerBaseUrl,
  providerAddress,
  ensureToken,
  dseq,
  gseq,
  oseq,
  services,
  selectedServices
}: UseLogStreamInput) {
  const container = useServices();
  const containerRef = useRef(container);
  containerRef.current = container;
  const [logText, setLogText] = useState("");
  const [status, setStatus] = useState<LogStreamStatus>("idle");
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const lines = useRef<string[]>([]);

  const flushLines = useThrottledCallback(() => setLogText(lines.current.join("\n")), [], FLUSH_INTERVAL_MS);

  const reconnect = useCallback(() => setReconnectNonce(nonce => nonce + 1), []);

  const servicesCount = services.length;
  const selectedServicesKey = selectedServices.join(",");

  useEffect(() => {
    lines.current = [];
    setLogText("");

    const selected = selectedServicesKey ? selectedServicesKey.split(",") : [];
    const canStream =
      enabled && !!providerBaseUrl && !!providerAddress && !!dseq && gseq !== undefined && oseq !== undefined && servicesCount > 0 && selected.length > 0;

    if (!canStream) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");

    const { providerProxy, errorHandler } = containerRef.current;
    const abortController = new AbortController();
    let silenceTimerId: ReturnType<typeof setTimeout> | undefined;
    let silenceCountdownCancelled = false;
    const cancelSilenceCountdown = () => {
      silenceCountdownCancelled = true;
      clearTimeout(silenceTimerId);
    };

    ensureToken()
      .then(() => {
        if (silenceCountdownCancelled) return;

        silenceTimerId = setTimeout(() => setStatus("silent"), SILENT_STREAM_TIMEOUT_MS);
      })
      .catch(() => undefined);

    forEachGeneratedItem(
      providerProxy.getLogsStream({
        providerBaseUrl,
        providerAddress,
        ensureToken,
        dseq,
        gseq,
        oseq,
        type: mode,
        follow: true,
        services: selected.length < servicesCount ? selected : undefined,
        signal: abortController.signal
      }),
      (proxyMessage: ProviderProxyMessage<LogEntryMessage> | ProviderProxyMessage<K8sEventMessage>) => {
        cancelSilenceCountdown();

        if (proxyMessage.closed) {
          setStatus("closed");
          return;
        }

        const line = mode === "logs" ? formatLogMessage(proxyMessage.message as LogEntryMessage) : formatK8sEvent(proxyMessage.message as K8sEventMessage);
        lines.current = lines.current.concat(line);
        setStatus("streaming");
        flushLines();
      }
    )
      .then(() => {
        if (abortController.signal.aborted) return;

        cancelSilenceCountdown();
        setStatus("closed");
      })
      .catch(error => {
        if (abortController.signal.aborted) return;

        cancelSilenceCountdown();
        setStatus("closed");
        errorHandler.reportError({ error, tags: { category: "deployments", label: "followLogs" } });
      });

    return () => {
      cancelSilenceCountdown();
      abortController.abort();
    };
  }, [enabled, mode, providerBaseUrl, providerAddress, ensureToken, dseq, gseq, oseq, servicesCount, selectedServicesKey, reconnectNonce, flushLines]);

  return { logText, status, reconnect };
}
