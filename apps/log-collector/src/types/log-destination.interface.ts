/**
 * Service interface for sending logs to external destination services
 *
 * Provides a standardized interface for log forwarding to external services
 * like DataDog, Fluentd, or other log aggregation systems.
 */
export interface LogDestinationService {
  /**
   * Send a log message to the destination service
   * @param logMessage The log message content
   * @param metadata Additional metadata for the log (tags, source, etc.)
   */
  sendLogs(log: Log): Promise<void>;
}

/**
 * Standardized log entry structure for external log services
 *
 * Defines the structure for log entries that will be sent to external
 * log aggregation services, including all necessary metadata and context.
 */
export interface Log {
  /** Message of the log */
  message: string;
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
  /** Timestamp of the log entry (milliseconds since epoch) */
  timestamp: number;
  /** Namespace (for Kubernetes logs) */
  namespace?: string;
  /** Pod name (for Kubernetes logs) */
  podName?: string;
}

/**
 * Kubernetes-specific log entry structure
 *
 * Represents a log entry specifically from Kubernetes pods, including
 * pod and namespace information for proper log routing and filtering.
 */
export interface K8sLogEntry {
  podName: string;
  namespace: string;
  logMessage: string;
  timestamp?: string;
}
