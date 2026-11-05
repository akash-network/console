"use client";
import type { FC, ReactNode } from "react";
import { Stethoscope } from "lucide-react";

import type { AssistantDiagnosis } from "@src/types/assistant";

type Props = {
  diagnosis: AssistantDiagnosis;
  children: ReactNode;
};

/** Shows what the assistant found in the logs or events next to the fix it proposes, so the user can check the evidence before confirming. */
export const DiagnosisBlock: FC<Props> = ({ diagnosis, children }) => (
  <section aria-label="Diagnosis" className="flex flex-col gap-3 rounded-xl border bg-card p-4">
    <header className="flex items-center gap-2 text-sm font-semibold">
      <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      What went wrong
    </header>
    {diagnosis.evidence.length > 0 && (
      <pre
        aria-label="Evidence"
        className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted px-3 py-2 font-mono text-xs text-red-700 dark:text-red-400"
      >
        {diagnosis.evidence.join("\n")}
      </pre>
    )}
    <p className="text-sm">{diagnosis.summary}</p>
    {children}
  </section>
);
