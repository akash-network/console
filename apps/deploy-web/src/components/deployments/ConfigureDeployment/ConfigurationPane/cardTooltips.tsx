/**
 * Help copy shown behind the info icon in each Configuration pane card header.
 * Adapted from the legacy SDL form controls under `components/sdl/*` (e.g.
 * {@link GpuFormControl}, {@link CpuFormControl}). Concrete min/max limits are
 * intentionally left out: they are enforced (and surfaced) by input validation,
 * so stating them here would only risk drifting out of sync.
 */

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
