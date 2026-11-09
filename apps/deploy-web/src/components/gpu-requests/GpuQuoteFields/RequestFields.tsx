import type { ReactNode } from "react";
import { Input, Textarea } from "@akashnetwork/ui/components";

import { REGION_AREAS, REGION_MODES, REQUESTABLE_TERMS, STARTS, UPTIME_SLAS } from "../gpuQuoteDraft/gpuQuoteCatalog";
import { ChoiceChips, FieldGroup, MultiChoiceChips } from "./ChoiceControls";
import type { DraftFieldProps } from "./HardwareFields";

const MAX_CONTACT_FIELD_LENGTH = 100;
const MAX_NOTES_LENGTH = 2000;

export function RegionField({ draft, onChange }: DraftFieldProps) {
  const areasLabel = draft.regionMode === "only" ? "Regions to run in" : "Regions to leave out";

  return (
    <div className="flex flex-col gap-3">
      <ChoiceChips label="Region" choices={REGION_MODES} value={draft.regionMode} onChange={regionMode => onChange({ regionMode })} />
      {draft.regionMode !== "any" && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted p-3">
          <span className="text-sm font-medium">{areasLabel}</span>
          <MultiChoiceChips label={areasLabel} choices={REGION_AREAS} values={draft.areas} onChange={areas => onChange({ areas })} />
        </div>
      )}
    </div>
  );
}

export function SlaField({ draft, onChange }: DraftFieldProps) {
  return <ChoiceChips label="Uptime guarantee" choices={UPTIME_SLAS} value={draft.sla} onChange={sla => onChange({ sla })} />;
}

export function TimingField({ draft, onChange, today }: DraftFieldProps & { today: string }) {
  return (
    <div className="flex flex-col gap-6">
      <FieldGroup label="How long do you need them?">
        <ChoiceChips label="Term" choices={REQUESTABLE_TERMS} value={draft.term} onChange={term => onChange({ term })} />
      </FieldGroup>
      <FieldGroup label="When should they start?">
        <ChoiceChips label="Start" choices={STARTS} value={draft.start} onChange={start => onChange({ start })} />
        {draft.start === "date" && (
          <Input
            id="gpu-quote-start-date"
            type="date"
            label="Start date"
            min={today}
            value={draft.startDate}
            onChange={event => onChange({ startDate: event.target.value })}
            className="max-w-xs"
          />
        )}
      </FieldGroup>
    </div>
  );
}

export function ContactField({ draft, onChange }: DraftFieldProps) {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Input
        id="gpu-quote-email"
        type="email"
        label="Email"
        autoComplete="email"
        value={draft.email}
        onChange={event => onChange({ email: event.target.value })}
      />
      <Input
        id="gpu-quote-phone"
        type="tel"
        label={<OptionalLabel>Phone</OptionalLabel>}
        autoComplete="tel"
        maxLength={MAX_CONTACT_FIELD_LENGTH}
        value={draft.phone}
        onChange={event => onChange({ phone: event.target.value })}
      />
      <Input
        id="gpu-quote-company"
        label={<OptionalLabel>Company</OptionalLabel>}
        autoComplete="organization"
        maxLength={MAX_CONTACT_FIELD_LENGTH}
        value={draft.company}
        onChange={event => onChange({ company: event.target.value })}
      />
      <Textarea
        id="gpu-quote-notes"
        label={<OptionalLabel>Anything else we should know?</OptionalLabel>}
        rows={3}
        placeholder="Workload, software stack, compliance needs…"
        maxLength={MAX_NOTES_LENGTH}
        value={draft.notes}
        onChange={event => onChange({ notes: event.target.value })}
      />
    </div>
  );
}

function OptionalLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="font-normal text-muted-foreground">(optional)</span>
    </>
  );
}
