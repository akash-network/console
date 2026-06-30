import { usePhasedProgressBar } from "@src/hooks/useGradualProgress/usePhasedProgressBar";

type DeployPhaseId = "creating" | "matching" | "preparing";
/** The active step the configure deploy can be on while the overlay is up: the lease ("preparing"), then "success" once it lands. Create + match already happened before the overlay mounted, so they only ever read as completed. */
export type DeployActivePhase = "preparing" | "success";
type Phase = { id: DeployPhaseId; label: string; status: "pending" | "active" | "completed" };
type State = { kind: DeployActivePhase };

const PHASE_ORDER: ReadonlyArray<DeployPhaseId> = ["creating", "matching", "preparing"];

/**
 * Where each phase ends on the bar (0–100); mirrors the 3-phase checkpoint layout.
 * TODO(onboarding-merge): these phase shapes/markers/time-constants/labels mirror `usePhasedDeploymentFlow`;
 * consolidate into a shared module when onboarding's quick-deploy folds into the configure flow.
 */
const MARKERS: ReadonlyArray<number> = PHASE_ORDER.map((_, i) => ((i + 1) / PHASE_ORDER.length) * 100);

/** Per-phase easing time constants in ms — creating is quick; preparing is the active lease step. */
const TIME_CONSTANTS: ReadonlyArray<number> = [3000, 12000, 6000];

const PHASE_LABELS: Record<DeployPhaseId, { active: string; completed: string }> = {
  creating: { active: "Creating deployment", completed: "Deployment created" },
  matching: { active: "Matching providers", completed: "Providers matched" },
  preparing: { active: "Preparing deployment", completed: "Deployment prepared" }
};

/**
 * Renders the reused PhasedDeploymentProgress for the configure flow as a pure function of the deploy's
 * current active step, passed down from `useDeploymentFlow`. The overlay only mounts during `deploying`, by
 * which point the deployment is created and the provider chosen — so the active step is the lease
 * ("preparing"), and the earlier phases read as completed because they precede it. On "success" every phase
 * is completed and the bar fills to 100% so the deploy visibly finishes before the redirect. Deploy failures
 * unmount the overlay and surface a toast, so there is no error state here.
 */
export function useConfigureDeployProgress(activePhase: DeployActivePhase): {
  state: State;
  progressPercent: number;
  phases: [Phase, Phase, Phase];
} {
  const succeeded = activePhase === "success";
  const activeIndex = succeeded ? PHASE_ORDER.length : PHASE_ORDER.indexOf(activePhase);
  const animatedPercent = usePhasedProgressBar({ markers: MARKERS, activeIndex, timeConstants: TIME_CONSTANTS, resetKey: 0 });

  const phases = PHASE_ORDER.map(function toPhase(id, index): Phase {
    const status = succeeded || index < activeIndex ? "completed" : index === activeIndex ? "active" : "pending";
    return { id, label: status === "completed" ? PHASE_LABELS[id].completed : PHASE_LABELS[id].active, status };
  }) as [Phase, Phase, Phase];

  return {
    state: { kind: activePhase },
    progressPercent: succeeded ? 100 : animatedPercent,
    phases
  };
}
