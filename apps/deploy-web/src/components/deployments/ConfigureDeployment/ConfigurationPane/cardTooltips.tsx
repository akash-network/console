/**
 * Help copy shown behind the info icon in each Configuration pane card header.
 * Adapted from the legacy SDL form controls under `components/sdl/*` (e.g.
 * {@link GpuFormControl}, {@link CpuFormControl}). Concrete min/max limits are
 * intentionally left out: they are enforced (and surfaced) by input validation,
 * so stating them here would only risk drifting out of sync.
 */

import { CONFIDENTIAL_COMPUTE_DOCS_URL } from "@src/utils/confidentialCompute";

export const presetsTooltip = (
  <>
    Apply a starting point for this service's compute resources.
    <br />
    <br />
    Picking a preset overwrites the CPU, memory, storage and GPU values below. You can fine-tune them afterwards.
  </>
);

export const gpuTooltip = (
  <>
    The amount of GPUs required for this workload.
    <br />
    <br />
    You can also specify the GPU vendor and model you want specifically. If you don't specify any model, providers with any GPU model will bid on your workload.
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/advanced-features/#gpu-configuration" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const computeResourcesTooltip = (
  <>
    The compute resources required for this workload.
    <br />
    <br />
    Ephemeral storage is wiped out on every deployment update or provider reboot.
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/#compute" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const ramStorageTooltip = (
  <>
    The amount of RAM-backed storage required for this workload.
    <br />
    <br />
    This volume is mounted in memory, so it is fast but ephemeral — its contents are lost when the container restarts.
  </>
);

export const persistentStorageTooltip = (
  <>
    The amount of persistent storage required for this workload.
    <br />
    <br />
    This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/advanced-features/#persistent-storage" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const confidentialComputeTooltip = (
  <>
    Run this service inside a Trusted Execution Environment (TEE) so its memory stays encrypted and isolated from the provider.
    <br />
    <br />
    Choose <strong>CPU</strong> for a CPU-only enclave, or <strong>CPU-GPU</strong> to additionally attest the GPU — which requires GPU resources on the
    service.
    <br />
    <br />
    All services in the same placement group must agree on their confidential compute type; conflicting types are rejected when the deployment is validated.
    <br />
    <br />
    <a href={CONFIDENTIAL_COMPUTE_DOCS_URL} target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const imageRuntimeTooltip = (
  <>
    Docker image of the container.
    <br />
    <br />
    Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/advanced-features/#environment-variables" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const commandsTooltip = (
  <>
    Custom command used when executing container.
    <br />
    <br />
    An example and popular use case is to run a bash script to install packages or run specific commands.
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/advanced-features/#command-and-args-override" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const exposePortsTooltip = (
  <>
    Map a container port to an externally reachable port and choose how it is routed.
    <br />
    <br />
    Public routing accepts connections from any IP; internal routing keeps the port reachable only from other services in the deployment. Accepted hostnames
    apply to HTTP traffic and only when the port isn&apos;t internal.
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/syntax-reference/#expose" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);

export const logsTooltip = (
  <>
    Forward this service's logs to a third-party monitoring provider.
    <br />
    <br />
    Enabling log forwarding adds a separate collector service to your deployment that ships the primary service's logs (currently to Datadog).
    <br />
    <br />
    <a href="https://akash.network/docs/developers/deployment/akash-sdl/advanced-features/#log-forwarding" target="_blank" rel="noopener">
      View official documentation
    </a>
  </>
);
