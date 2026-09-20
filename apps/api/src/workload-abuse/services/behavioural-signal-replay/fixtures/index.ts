import type { ProbeEvidenceSnapshot } from "@src/workload-abuse/lib/behavioural-signals/types";
import acceleratorBoundNoArtifacts from "./accelerator-bound-no-artifacts.json";
import cpuOnlyWorkload from "./cpu-only-workload.json";
import idleShellHost from "./idle-shell-host.json";
import inferenceWithWeights from "./inference-with-weights.json";
import packagedRuntime from "./packaged-runtime.json";

export type BehaviouralReplayFixture = { deployment: string; snapshots: ProbeEvidenceSnapshot[] };

export const BUNDLED_REPLAY_FIXTURES: BehaviouralReplayFixture[] = [
  acceleratorBoundNoArtifacts,
  inferenceWithWeights,
  idleShellHost,
  packagedRuntime,
  cpuOnlyWorkload
];
