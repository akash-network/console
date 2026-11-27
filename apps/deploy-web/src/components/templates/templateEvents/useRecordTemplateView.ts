import { useEffect, useRef } from "react";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { useRecordTemplateViewMutation } from "@src/queries/useUserTemplateQueries";
import type { TemplateViewKind } from "@src/types/marketplace-template";

export const DEPENDENCIES = { useCustomUser, useRecordTemplateViewMutation };

/** Tells the API once for each Console template the caller names, so its publisher sees it in Insights; only signed-in users count, and a failure costs the page nothing. */
export function useRecordTemplateView(kind: TemplateViewKind, templateId: string | undefined, d: typeof DEPENDENCIES = DEPENDENCIES) {
  const { user } = d.useCustomUser();
  const { mutate: recordView } = d.useRecordTemplateViewMutation();
  const isSignedIn = !!user;
  const recordedTemplateId = useRef<string>();

  useEffect(
    function recordTheViewOnce() {
      if (!isSignedIn || !templateId || recordedTemplateId.current === templateId) return;
      recordedTemplateId.current = templateId;
      recordView({ id: templateId, data: { kind } });
    },
    [recordView, kind, templateId, isSignedIn]
  );
}
