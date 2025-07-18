export interface LogDestinationService {
  /**
   * Send a log message to the destination service
   * @param logMessage The log message content
   * @param metadata Additional metadata for the log (tags, source, etc.)
   */
  sendLog(logMessage: string, metadata: LogMetadata): Promise<void>;
}

export interface LogMetadata {
  /** Source of the log (e.g., "kubernetes", "akash") */
  source: string;
  /** Environment tag (e.g., "staging", "production") */
  environment: string;
  /** Additional tags as key-value pairs */
  tags: Record<string, string>;
  /** Hostname or pod name */
  hostname: string;
  /** Service name */
  service: string;
  /** Namespace (for Kubernetes logs) */
  namespace?: string;
  /** Pod name (for Kubernetes logs) */
  podName?: string;
}

export interface K8sLogEntry {
  podName: string;
  namespace: string;
  logMessage: string;
  timestamp?: string;
}
