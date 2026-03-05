/**
 * Custom Monaco language definition for deployment logs/events.
 *
 * Log format (logs):   [serviceName]: message
 * Event format:        [serviceName]: [severity] [reason] [objectKind] note
 *
 * Supported severity levels: [Normal], [Warning], [Error]
 * Examples:
 *   [web]: [Normal] [Scheduled] [Pod] Successfully assigned...
 *   [web]: [Warning] [BackOff] [Pod] Back-off restarting failed container
 *   [web]: [Error] [Failed] [Pod] Error: ImagePullBackOff
 */

/* eslint-disable no-useless-escape */
import { languages } from "monaco-editor/esm/vs/editor/editor.api.js";

const k8sEventsLanguage: languages.IMonarchLanguage = {
  tokenPostfix: ".k8s-events",
  tokenizer: {
    root: [
      // Component/namespace at the beginning (e.g., [web]:, [ingress.provider]:)
      [/^\[[\w.-]+\]:/, "namespace"],

      // Severity levels
      [/\[Error\]/, "log.error"],
      [/\[Warning\]/, "log.warning"],
      [/\[Normal\]/, "log.info"],

      // Kubernetes resource kinds - highlight as types
      [
        /\[(Pod|Deployment|ReplicaSet|Service|Ingress|StatefulSet|DaemonSet|Job|CronJob|ConfigMap|Secret|PersistentVolumeClaim|PersistentVolume|Namespace|Node|Event|HorizontalPodAutoscaler|NetworkPolicy)\]/,
        "type"
      ],

      // Error/failure-related reasons - highlight as errors
      [/\[(Failed|FailedScheduling|FailedCreate|FailedMount|BackOff|CrashLoopBackOff|Unhealthy|Killing|Evicted|FailedKillPod|FailedSync)\]/, "log.error"],

      // Reasons/Actions (any other bracketed word like [Scheduled], [Pulled], [Created], etc.)
      [/\[[\w]+\]/, "variable"],

      // Message text (everything not in brackets)
      [/[^\[]+/, "string"]
    ]
  }
};

languages.register({ id: "k8s-events" });
languages.setMonarchTokensProvider("k8s-events", k8sEventsLanguage);
