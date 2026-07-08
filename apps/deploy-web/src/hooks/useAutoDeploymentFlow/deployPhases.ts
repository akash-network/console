import { usePhasedProgressBar } from "@src/hooks/useGradualProgress/usePhasedProgressBar";

export type DeployPhaseId = "creating" | "matching" | "preparing";
export type DeployPhaseStatus = "pending" | "active" | "completed";
export type DeployPhase = { id: DeployPhaseId; label: string; status: DeployPhaseStatus };

/** The progress state the shared deploy scene renders from: an in-flight/succeeded phase, or a terminal error. */
export type DeployProgressState = { kind: DeployPhaseId | "success" } | { kind: "error"; message?: string };

/** The step a *manual* configure deploy can be on while its scene is up: the lease ("preparing"), then "success". */
export type ManualDeployActivePhase = "preparing" | "success";

export const PHASE_ORDER: ReadonlyArray<DeployPhaseId> = ["creating", "matching", "preparing"];

/**
 * Where each phase *ends* on the bar (0–100). These mirror the checkpoint marker positions in
 * PhasedDeploymentProgress (`(i + 1) / phases.length * 100`), so the fill lands exactly on a marker when its
 * phase completes.
 */
export const PHASE_MARKERS: ReadonlyArray<number> = PHASE_ORDER.map((_, i) => ((i + 1) / PHASE_ORDER.length) * 100);

/**
 * Per-phase easing time constant in ms — roughly how long that phase typically takes, which sets how fast the
 * bar creeps toward the next marker. `creating` is a quick tx broadcast; `matching` is the long bid-poll/probe
 * wait; `preparing` is a medium lease step.
 */
export const PHASE_TIME_CONSTANTS: ReadonlyArray<number> = [3000, 12000, 6000];

export const PHASE_LABELS: Record<DeployPhaseId, { active: string; completed: string }> = {
  creating: { active: "Creating deployment", completed: "Deployment created" },
  matching: { active: "Matching with providers", completed: "Providers matched" },
  preparing: { active: "Preparing deployment", completed: "Deployment prepared" }
};

/** Builds the three phase descriptors from the active phase index; every phase reads completed once `allCompleted`. */
export function buildDeployPhases(activeIndex: number, allCompleted = false): [DeployPhase, DeployPhase, DeployPhase] {
  const phases = PHASE_ORDER.map((id, i): DeployPhase => {
    const status: DeployPhaseStatus = allCompleted || i < activeIndex ? "completed" : i === activeIndex ? "active" : "pending";
    return { id, label: status === "completed" ? PHASE_LABELS[id].completed : PHASE_LABELS[id].active, status };
  });
  return phases as [DeployPhase, DeployPhase, DeployPhase];
}

/**
 * The shared progress projection both deploy scenes render from: animates the bar toward the active phase's marker
 * (`creating` → `matching` → `preparing`) and builds the matching phase descriptors. Callers own only how they
 * derive the active index and success flag — the manual overlay from `useDeploymentFlow`'s deploy step, the auto
 * flow from the full `flow.phase` projection. On success the bar is pinned to 100% so the deploy visibly finishes
 * before the redirect. `resetKey` restarts the animation (the auto flow bumps it on retry).
 */
export function useDeployPhaseProgress(
  activeIndex: number,
  { succeeded = false, resetKey = 0 }: { succeeded?: boolean; resetKey?: number } = {}
): { progressPercent: number; phases: [DeployPhase, DeployPhase, DeployPhase] } {
  const animatedPercent = usePhasedProgressBar({
    markers: PHASE_MARKERS,
    activeIndex: succeeded ? PHASE_MARKERS.length : activeIndex,
    timeConstants: PHASE_TIME_CONSTANTS,
    resetKey
  });
  return {
    progressPercent: succeeded ? 100 : animatedPercent,
    phases: buildDeployPhases(activeIndex, succeeded)
  };
}

/**
 * Progress state for the *manual* configure deploy, driven by `useDeploymentFlow`'s deploy step. The scene only
 * mounts during `deploying`, by which point the deployment exists and the provider is chosen — so creating +
 * matching read as completed and the active step is the lease ("preparing"), reaching "success" once the lease
 * lands. Deploy failures unmount the scene and surface a toast, so there is no error state here.
 */
export function usePhasedDeployProgress(activePhase: ManualDeployActivePhase): {
  state: DeployProgressState;
  progressPercent: number;
  phases: [DeployPhase, DeployPhase, DeployPhase];
} {
  const succeeded = activePhase === "success";
  const activeIndex = succeeded ? PHASE_ORDER.length : PHASE_ORDER.indexOf(activePhase);
  const { progressPercent, phases } = useDeployPhaseProgress(activeIndex, { succeeded });
  return { state: { kind: activePhase }, progressPercent, phases };
}
