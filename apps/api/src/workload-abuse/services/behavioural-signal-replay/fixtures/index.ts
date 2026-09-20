import { z } from "zod";

import acceleratorBoundNoArtifacts from "./accelerator-bound-no-artifacts.json";
import cpuOnlyWorkload from "./cpu-only-workload.json";
import idleShellHost from "./idle-shell-host.json";
import inferenceWithWeights from "./inference-with-weights.json";
import packagedRuntime from "./packaged-runtime.json";

const PROCESS_SCHEMA = z.object({ pid: z.number(), name: z.string(), vramMb: z.number() });

const SNAPSHOT_SCHEMA = z.object({
  shellStatus: z.string(),
  accelerator: z
    .array(z.object({ name: z.string(), utilPct: z.number(), memUsedMb: z.number(), memTotalMb: z.number(), processes: z.array(PROCESS_SCHEMA) }))
    .nullable(),
  artifacts: z.array(z.object({ path: z.string(), sizeBytes: z.number() })).nullable(),
  netShape: z
    .object({
      listenPorts: z.array(z.number()),
      established: z.array(z.object({ localPort: z.number(), remoteIp: z.string(), remotePort: z.number(), count: z.number() }))
    })
    .nullable()
});

const FIXTURE_SCHEMA = z.object({ deployment: z.string(), snapshots: z.array(SNAPSHOT_SCHEMA) });

export type BehaviouralReplayFixture = z.infer<typeof FIXTURE_SCHEMA>;

export function parseReplayFixture(contents: unknown): BehaviouralReplayFixture {
  return FIXTURE_SCHEMA.parse(contents);
}

export const BUNDLED_REPLAY_FIXTURES: BehaviouralReplayFixture[] = [
  acceleratorBoundNoArtifacts,
  inferenceWithWeights,
  idleShellHost,
  packagedRuntime,
  cpuOnlyWorkload
];
