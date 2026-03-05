/**
 * Custom Monaco language definition for deployment logs.
 * Enhanced with VS Code log syntax patterns for:
 * - Log levels (TRACE, DEBUG, INFO, WARN, ERROR, FATAL, etc.)
 * - Timestamps and dates (ISO 8601, various formats)
 * - Constants (UUIDs, SHA hashes, MAC addresses, numbers, booleans)
 * - Strings (quoted text)
 * - Exceptions (Exception class names, stack traces)
 * - URLs and network addresses
 */

/* eslint-disable no-useless-escape */
import { languages } from "monaco-editor/esm/vs/editor/editor.api.js";

const logLanguage: languages.IMonarchLanguage = {
  tokenPostfix: ".log",
  ignoreCase: false,
  tokenizer: {
    root: [
      // Component/namespace at the beginning (e.g., [web]:, [ingress.provider]:)
      [/^\[[\w.-]+\]:/, "namespace"],

      // Akash-specific severity levels (keep these before generic log levels for priority)
      [/\[Error\]/, "log.error"],
      [/\[Warning\]/, "log.warning"],
      [/\[Normal\]/, "log.debug"],

      // Kubernetes resource kinds - highlight as types
      [
        /\[(Pod|Deployment|ReplicaSet|Service|Ingress|StatefulSet|DaemonSet|Job|CronJob|ConfigMap|Secret|PersistentVolumeClaim|PersistentVolume|Namespace|Node|Event|HorizontalPodAutoscaler|NetworkPolicy)\]/,
        "type"
      ],

      // Error/failure-related reasons - highlight as errors
      [/\[(Failed|FailedScheduling|FailedCreate|FailedMount|BackOff|CrashLoopBackOff|Unhealthy|Killing|Evicted|FailedKillPod|FailedSync)\]/, "log.error"],

      // Reasons/Actions (any other bracketed word like [Scheduled], [Pulled], [Created], etc.)
      [/\[[\w]+\]/, "variable"],

      // === VS Code Log Syntax Patterns ===

      // Log levels - ERROR/FATAL/CRITICAL/ALERT (case-insensitive variations)
      [
        /\b(ALERT|Alert|alert|CRITICAL|Critical|critical|EMERGENCY|Emergency|emergency|ERROR|Error|error|FAILURE|Failure|failure|FAIL|Fail|fail|FATAL|Fatal|fatal|EE)\b/,
        "log.error"
      ],
      [/\[(error|eror|err|er|e|fatal|fatl|ftl|fa|f|ERROR|EROR|ERR|ER|E|FATAL|FATL|FTL|FA|F)\]/, "log.error"],

      // Log levels - WARNING/WARN (case-insensitive)
      [/\b(WARNING|Warning|warning|WARN|Warn|warn|WW)\b/, "log.warning"],
      [/\b(warning|WARNING)\s*:/, "log.warning"],
      [/\[(warning|warn|wrn|wn|w|WARNING|WARN|WRN|WN|W)\]/, "log.warning"],

      // Log levels - INFO/NOTICE/HINT (case-insensitive)
      [/\b(HINT|Hint|hint|INFO|Info|info|INFORMATION|Information|information|NOTICE|Notice|notice|II)\b/, "log.info"],
      [/\b(info|information|INFO|INFORMATION)\s*:/, "log.info"],
      [/\[(information|info|inf|in|i|INFORMATION|INFO|INF|IN|I)\]/, "log.info"],

      // Log levels - DEBUG (case-insensitive)
      [/\b(DEBUG|Debug|debug)\b/, "log.debug"],
      [/\b(debug|DEBUG)\s*:/, "log.debug"],
      [/\[(debug|dbug|dbg|de|d|DEBUG|DBUG|DBG|DE|D)\]/, "log.debug"],

      // Log levels - TRACE/VERBOSE (case-insensitive)
      [/\b(Trace|TRACE|trace)\b:?/, "log.verbose"],
      [/\[(verbose|verb|vrb|vb|v|VERBOSE|VERB|VRB|VB|V)\]/, "log.verbose"],

      // Exception types (e.g., NullPointerException, IOException)
      [/\b([a-zA-Z.]*Exception)\b/, "log.exception"],

      // Stack trace lines (lines starting with "at ")
      [/^[\t ]*at[\t ].*$/, "log.exception"],

      // ISO 8601 dates (YYYY-MM-DD)
      [/\b\d{4}-\d{2}-\d{2}(?=T|\b)/, "log.date"],

      // Other date formats (DD/MM/YYYY, DD-MM-YYYY, etc.)
      [/\d{2}[^\w\s]\d{2}[^\w\s]\d{4}\b/, "log.date"],

      // Time formats with timezone (HH:MM:SS.mmm+TZ or THHMMSS)
      [/T?\d{1,2}:\d{2}(:\d{2}([.,]\d{1,})?)?(Z| ?[+-]\d{1,2}:\d{2})?\b/, "log.date"],
      [/T\d{2}\d{2}(\d{2}([.,]\d{1,})?)?(Z| ?[+-]\d{1,2}\d{2})?\b/, "log.date"],

      // UUIDs (8-4-4-4-12 format)
      [/\b[0-9a-fA-F]{8}-?([0-9a-fA-F]{4}-?){3}[0-9a-fA-F]{12}\b/, "constant.language"],

      // SHA hashes (40, 10, or 7 characters)
      [/\b[0-9a-fA-F]{40}\b/, "constant.language"],
      [/\b[0-9a-fA-F]{10}\b/, "constant.language"],
      [/\b[0-9a-fA-F]{7}\b/, "constant.language"],

      // MAC addresses and hex sequences with colons/hyphens
      [/\b([0-9a-fA-F]{2,}[:-])+[0-9a-fA-F]{2,}\b/, "constant.language"],

      // Hexadecimal numbers (0x prefix)
      [/\b0x[a-fA-F0-9]+\b/, "constant.language"],

      // Numbers
      [/\b\d+(\.\d+)?\b/, "constant.numeric"],

      // Booleans and null
      [/\b(true|false|null|TRUE|FALSE|NULL)\b/, "constant.language"],

      // URLs (http://, https://, ftp://, etc.)
      [/\b[a-z]+:\/\/\S+/, "constant.language"],

      // Domain names (e.g., example.com, api.github.com)
      [/\b([\w-]+\.)+[\w-]+\b/, "constant.language"],

      // Double-quoted strings
      [/"[^"]*"/, "string"],

      // Single-quoted strings
      [/'[^']*'/, "string"],

      // Message text (everything else) - catch remaining content
      [/.+?/, ""]
    ]
  }
};

languages.register({ id: "log" });
languages.setMonarchTokensProvider("log", logLanguage);
