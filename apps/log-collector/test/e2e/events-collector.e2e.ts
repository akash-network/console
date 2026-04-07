/**
 * E2E tests for the log and event collector.
 *
 * Prerequisites:
 *   1. Local K8s cluster (Docker Desktop, Minikube, Kind, K3s, OrbStack)
 *   2. `make dev` from apps/log-collector/ (builds image, deploys collector + target)
 *   3. k8s/.env.local with at least: DD_SITE, DD_API_KEY, STDOUT=true, POD_LABEL_SELECTOR=app=log-target
 *
 * Run:
 *   npm run test:e2e
 *
 * Optional env vars (via k8s/.env.local or exported):
 *   DD_APP_KEY  — Datadog application key. When set, the Datadog delivery test runs.
 *                 Without it the test is skipped and only Fluent Bit stdout is verified.
 */
import { config } from "@dotenvx/dotenvx";
import { AppsV1Api, CoreV1Api, Exec, KubeConfig, RbacAuthorizationV1Api } from "@kubernetes/client-node";
import { execSync } from "child_process";
import path from "path";
import { PassThrough } from "stream";
import { beforeAll, describe, expect, it } from "vitest";

config({ path: path.resolve(__dirname, "../../k8s/.env.local"), quiet: true });

const NAMESPACE = "log-collector";
const COLLECTOR_DEPLOYMENT = "log-collector";
const TARGET_DEPLOYMENT = "log-target";
const DD_SITE = process.env.DD_SITE || "datadoghq.eu";
const K8S_DIR = path.resolve(__dirname, "../../k8s");

describe("Logs and Events Collector E2E", () => {
  beforeAll(() => {
    execSync(`kubectl apply -f ${K8S_DIR}`, { stdio: "ignore" });
    execSync(`kubectl rollout restart deployment/${COLLECTOR_DEPLOYMENT} -n ${NAMESPACE}`, { stdio: "ignore" });
    execSync(`kubectl rollout status deployment/${COLLECTOR_DEPLOYMENT} -n ${NAMESPACE} --timeout=30s`, { stdio: "ignore" });
  });

  it("should collect events and logs for existing pods on startup", async () => {
    const { targetPod, getPodLogFileContent } = await setup();

    await vi.waitFor(
      async () => {
        const content = await getPodLogFileContent(targetPod);
        expect(content).toContain('"reason":"Scheduled"');
        expect(content).toContain('"reason":"Started"');
        expect(content).toMatch(/\[INFO]|\[ERROR]|\[DEBUG]/);
      },
      { timeout: 15_000, interval: 2000 }
    );
  });

  it("should collect events for new pods after target restart", async () => {
    const { k8sCore, k8sApps, getPodLogFileContent, waitForRollout } = await setup();

    await restartDeployment(k8sApps, TARGET_DEPLOYMENT);
    await waitForRollout(TARGET_DEPLOYMENT);

    // Wait for new pod to be running and old pod to terminate
    const newPod = await waitForNewPod(k8sCore, TARGET_DEPLOYMENT);

    await vi.waitFor(
      async () => {
        const content = await getPodLogFileContent(newPod);
        expect(content).toContain('"reason":"Scheduled"');
        expect(content).toContain('"reason":"Started"');
        expect(content).toMatch(/\[INFO]|\[ERROR]|\[DEBUG]/);
      },
      { timeout: 30_000, interval: 2000 }
    );
  });

  it("should forward events and logs through Fluent Bit", async () => {
    const { k8sCore, getCollectorPodName } = await setup();

    await vi.waitFor(
      async () => {
        const collectorPod = await getCollectorPodName();
        const logs = String(await k8sCore.readNamespacedPodLog({ name: collectorPod, namespace: NAMESPACE, container: COLLECTOR_DEPLOYMENT }));

        expect(logs).toContain('"reason"');
        expect(logs).toContain('"phase"');
        expect(logs).toMatch(/\[INFO]|\[ERROR]|\[DEBUG]/);
      },
      { timeout: 15_000, interval: 2000 }
    );
  });

  it.skipIf(!process.env.DD_APP_KEY)("should deliver events and logs to Datadog", async () => {
    const { queryDatadog } = await setup();

    await vi.waitFor(
      async () => {
        const events = await queryDatadog("service:log-target @phase:ADDED");
        expect(events.data.length).toBeGreaterThan(0);
        expect(JSON.stringify(events.data[0])).toContain('"reason"');
      },
      { timeout: 30_000, interval: 5000 }
    );

    const logs = await queryDatadog("service:log-target -@phase:*");
    expect(logs.data.length).toBeGreaterThan(0);
  });

  it("should continue log collection when events watch is forbidden", async () => {
    const { k8sCore, k8sApps, k8sRbac, getCollectorPodName, waitForRollout } = await setup();

    const role = await k8sRbac.readNamespacedRole({ name: "tenant-pod-reader", namespace: NAMESPACE });
    role.rules = role.rules!.map(rule => {
      if (rule.resources?.includes("events")) {
        return { ...rule, verbs: ["get", "list"] };
      }
      return rule;
    });
    await k8sRbac.replaceNamespacedRole({ name: "tenant-pod-reader", namespace: NAMESPACE, body: role });

    try {
      await restartDeployment(k8sApps, COLLECTOR_DEPLOYMENT);
      await waitForRollout(COLLECTOR_DEPLOYMENT);

      await vi.waitFor(
        async () => {
          const collectorPod = await getCollectorPodName();
          const logs = String(await k8sCore.readNamespacedPodLog({ name: collectorPod, namespace: NAMESPACE, container: COLLECTOR_DEPLOYMENT }));
          expect(logs).toContain("POD_EVENTS_WATCH_FORBIDDEN");
          expect(logs).toContain("K8S_LOG_STREAM_ESTABLISHED");
        },
        { timeout: 15_000, interval: 2000 }
      );
    } finally {
      execSync(`kubectl apply -f ${K8S_DIR}/role.yaml`, { stdio: "ignore" });
    }
  });

  async function setup() {
    const kc = new KubeConfig();
    kc.loadFromDefault();
    const k8sCore = kc.makeApiClient(CoreV1Api);
    const k8sApps = kc.makeApiClient(AppsV1Api);
    const k8sRbac = kc.makeApiClient(RbacAuthorizationV1Api);
    const exec = new Exec(kc);

    const getRunningPod = async (labelSelector: string) => {
      const { items } = await k8sCore.listNamespacedPod({ namespace: NAMESPACE, labelSelector });
      const running = items.find(p => p.status?.phase === "Running");
      if (!running?.metadata?.name) throw new Error(`No running pod for ${labelSelector}`);
      return running.metadata.name;
    };

    const getCollectorPodName = () => getRunningPod("app=log-collector");

    const execInPod = async (podName: string, command: string[]): Promise<string> => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      let out = "";
      let err = "";
      stdout.on("data", chunk => (out += chunk));
      stderr.on("data", chunk => (err += chunk));

      await new Promise<void>((resolve, reject) => {
        exec
          .exec(NAMESPACE, podName, COLLECTOR_DEPLOYMENT, command, stdout, stderr, null, false, status => {
            if (status?.status === "Success") resolve();
            else reject(new Error(`exec failed: ${err}`));
          })
          .catch(reject);
      });

      return out;
    };

    const getPodLogFileContent = async (targetPodName: string) => {
      const collectorPod = await getCollectorPodName();
      return execInPod(collectorPod, ["cat", `/app/apps/log-collector/log/${NAMESPACE}_${targetPodName}.log`]);
    };

    const waitForRollout = async (name: string, timeoutMs = 60_000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const deployment = await k8sApps.readNamespacedDeployment({ name, namespace: NAMESPACE });
        const ready = deployment.status?.readyReplicas ?? 0;
        const desired = deployment.spec?.replicas ?? 1;
        const updated = deployment.status?.updatedReplicas ?? 0;
        if (ready >= desired && updated >= desired) return;
        await new Promise(r => setTimeout(r, 2000));
      }
      throw new Error(`Rollout timeout for ${name}`);
    };

    const queryDatadog = async (query: string) => {
      const apiKey = process.env.DD_API_KEY;
      const appKey = process.env.DD_APP_KEY;
      if (!apiKey || !appKey) throw new Error("DD_API_KEY and DD_APP_KEY required");

      const response = await fetch(`https://api.${DD_SITE}/api/v2/logs/events/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "DD-API-KEY": apiKey, "DD-APPLICATION-KEY": appKey },
        body: JSON.stringify({
          filter: { query, from: "now-5m", to: "now" },
          page: { limit: 10 },
          sort: "-timestamp"
        })
      });

      return (await response.json()) as { data: Array<{ attributes: Record<string, unknown> }> };
    };

    const targetPod = await getRunningPod("app=log-target");

    return { k8sCore, k8sApps, k8sRbac, targetPod, getCollectorPodName, getPodLogFileContent, waitForRollout, queryDatadog };
  }
});

async function restartDeployment(k8sApps: AppsV1Api, name: string): Promise<void> {
  const deployment = await k8sApps.readNamespacedDeployment({ name, namespace: NAMESPACE });
  deployment.spec!.template!.metadata!.annotations = {
    ...deployment.spec!.template!.metadata!.annotations,
    "kubectl.kubernetes.io/restartedAt": new Date().toISOString()
  };
  await k8sApps.replaceNamespacedDeployment({ name, namespace: NAMESPACE, body: deployment });
}

async function waitForNewPod(k8sCore: CoreV1Api, deploymentName: string, timeoutMs = 60_000): Promise<string> {
  const labelSelector = `app=${deploymentName}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const { items } = await k8sCore.listNamespacedPod({ namespace: NAMESPACE, labelSelector });
    const running = items.filter(p => p.status?.phase === "Running" && p.metadata?.deletionTimestamp === undefined);
    if (running.length === 1 && running[0].metadata?.name) {
      return running[0].metadata.name;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error(`Timeout waiting for new pod for ${deploymentName}`);
}
