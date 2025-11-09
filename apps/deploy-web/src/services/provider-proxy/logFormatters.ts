import type { K8sEventMessage, LogEntryMessage } from "./provider-proxy.service";

export function formatLogMessage(logEntry: LogEntryMessage): string {
  const serviceName = logEntry?.name ? logEntry?.name.split("-")[0] : "";
  // logEntry.message = `[${format(new Date(), "yyyy-MM-dd|HH:mm:ss.SSS")}] ${logEntry.service}: ${logEntry.message}`;
  return `[${serviceName}]: ${logEntry.message}`;
}

export function formatK8sEvent(k8sEvent: K8sEventMessage): string {
  const serviceName = k8sEvent.object?.name ? k8sEvent.object?.name.split("-")[0] : "";
  return `[${serviceName}]: [${k8sEvent.type}] [${k8sEvent.reason}] [${k8sEvent.object?.kind}] ${k8sEvent.note}`;
}
