import { useCallback, useEffect, useState } from "react";
import { atom, useAtom, useSetAtom } from "jotai";

import type { DeploymentIntent } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/deploymentIntent";

/** Held in memory, so only a click in this tab sets it and a reload or a link from another site arrives without it. */
const autoDeployStartAtom = atom<string | null>(null);

type ConfigureLocation = Partial<Pick<DeploymentIntent, "templateId" | "dseq" | "draftId" | "sdlStrategy" | "bidStrategy">>;

type ScreenState = {
  /** Whether the screen's flow has begun a deployment, which a start for the template already on screen must never repeat. */
  hasStartedDeploying: boolean;
};

export type AutoDeployStart = {
  /** The template the screen deploys on its own; null opens the form. */
  templateId: string | null;
  /** Changes each time a start takes over a screen that is already mounted, so the screen begins afresh for it. */
  key: number;
};

type Decision = AutoDeployStart & { decidedForTemplateId?: string };

/** Marks the template a deploy button of the console opens the configure screen for, which is what lets that screen deploy it on its own. */
export function useMarkAutoDeployStart() {
  const setAutoDeployStart = useSetAtom(autoDeployStartAtom);

  return useCallback((templateId: string) => setAutoDeployStart(templateId), [setAutoDeployStart]);
}

/** Takes each mark as it is set and decides when the click's push lands, since a push onto the mounted screen keeps it mounted. */
export function useTakeAutoDeployStart(location: ConfigureLocation, { hasStartedDeploying }: ScreenState): AutoDeployStart {
  const { templateId } = location;
  const [mark, setMark] = useAtom(autoDeployStartAtom);
  const [takenTemplateId, setTakenTemplateId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(() => ({ templateId: startedTemplateIdOf(mark, location), key: 0, decidedForTemplateId: templateId }));
  const pendingTemplateId = mark ?? takenTemplateId;

  if (decision.decidedForTemplateId !== templateId) {
    const startedTemplateId = startedTemplateIdOf(pendingTemplateId, location);
    setDecision({ templateId: startedTemplateId, key: startedTemplateId ? decision.key + 1 : decision.key, decidedForTemplateId: templateId });
    setTakenTemplateId(null);
  } else if (decision.templateId === null && !hasStartedDeploying && isConsoleStartUrl(location) && startedTemplateIdOf(pendingTemplateId, location)) {
    setDecision({ templateId: pendingTemplateId, key: decision.key + 1, decidedForTemplateId: templateId });
  }

  useEffect(
    function takeEachMark() {
      if (mark === null) return;
      setMark(null);
      setTakenTemplateId(mark);
    },
    [mark, setMark]
  );

  return { templateId: decision.templateId, key: decision.key };
}

/** A start is for a fresh deploy of its own template, never for a URL naming a deployment that already exists. */
function startedTemplateIdOf(takenTemplateId: string | null, { templateId, dseq }: ConfigureLocation): string | null {
  return templateId && !dseq && takenTemplateId === templateId ? templateId : null;
}

/** The screen writes its draft id into the URL once mounted, so only the push a deploy button just made lands without one. */
function isConsoleStartUrl({ sdlStrategy, bidStrategy, draftId }: ConfigureLocation): boolean {
  return sdlStrategy === "default" && bidStrategy === "auto" && !draftId;
}
