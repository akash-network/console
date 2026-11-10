import type { ReactNode } from "react";
import { useState } from "react";
import { Calendar, Input, Textarea } from "@akashnetwork/ui/components";
import { BanIcon, CalendarIcon, CheckIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";

import { REGION_AREAS, REGION_MODES, REQUESTABLE_TERMS, STARTS, UPTIME_SLAS } from "../gpuQuoteDraft/gpuQuoteCatalog";
import { toIsoDate } from "../gpuQuoteDraft/gpuQuoteDraft";
import { ChoiceChips, ChoiceTiles, FieldGroup, MultiChoiceChips } from "./ChoiceControls";
import type { DraftFieldProps } from "./HardwareFields";

const MAX_CONTACT_FIELD_LENGTH = 100;
const MAX_NOTES_LENGTH = 2000;

const TYPED_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;

export function RegionField({ draft, onChange }: DraftFieldProps) {
  const areasLabel = draft.regionMode === "only" ? "Where can they run?" : "Where can't they run?";

  return (
    <div className="flex flex-col gap-3">
      <ChoiceChips label="Region" choices={REGION_MODES} value={draft.regionMode} onChange={regionMode => onChange({ regionMode })} />
      {draft.regionMode !== "any" && (
        <div className="flex flex-col gap-2.5 rounded-[10px] border bg-muted px-3.5 pb-3.5 pt-3">
          <span className="text-[12.5px] font-medium">{areasLabel}</span>
          <MultiChoiceChips
            label={areasLabel}
            choices={REGION_AREAS}
            values={draft.areas}
            selectedIcon={draft.regionMode === "except" ? BanIcon : CheckIcon}
            onChange={areas => onChange({ areas })}
          />
        </div>
      )}
    </div>
  );
}

export function SlaField({ draft, onChange }: DraftFieldProps) {
  const isRare = UPTIME_SLAS.some(sla => sla.value === draft.sla && sla.isRare);

  return (
    <div className="flex flex-col gap-2.5">
      <ChoiceTiles
        label="Uptime guarantee"
        choices={UPTIME_SLAS.map(sla => ({ ...sla, isNumeric: sla.value !== null, badge: sla.isRare && <RareBadge /> }))}
        value={draft.sla}
        onChange={sla => onChange({ sla })}
      />
      {isRare && (
        <p className="flex items-start gap-2.5 rounded-[10px] border border-warning/35 bg-warning/10 px-3 py-2.5 text-[12.5px] leading-normal">
          <TriangleAlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
          Very few providers offer 99.9%. Expect fewer offers and a longer search, or choose 99.5% for more options.
        </p>
      )}
    </div>
  );
}

export function TimingField({ draft, onChange, today }: DraftFieldProps & { today: string }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup label="How long do you need them?">
        <ChoiceChips label="Term" choices={REQUESTABLE_TERMS} value={draft.term} onChange={term => onChange({ term })} />
      </FieldGroup>
      <FieldGroup label="When should they start?">
        <ChoiceChips label="Start" choices={STARTS} value={draft.start} onChange={start => onChange({ start })} />
        {draft.start === "date" && <StartDateField value={draft.startDate} today={today} onChange={startDate => onChange({ startDate })} />}
      </FieldGroup>
    </div>
  );
}

/** The date can be typed or picked; a typed date only counts once it is a real day from today on, so half-typed text never reaches the draft. */
function StartDateField({ value, today, onChange }: { value: string; today: string; onChange: (isoDate: string) => void }) {
  const [text, setText] = useState(() => toTypedDate(value));
  const [isInvalid, setIsInvalid] = useState(false);

  function typeDate(nextText: string) {
    setText(nextText);
    setIsInvalid(false);
    const isoDate = parseTypedDate(nextText);
    if (isoDate && isoDate >= today) onChange(isoDate);
  }

  function checkTypedDate() {
    if (!text.trim()) {
      onChange("");
      return;
    }
    const isoDate = parseTypedDate(text);
    setIsInvalid(!isoDate || isoDate < today);
  }

  function pickDate(date: Date | undefined) {
    const isoDate = date ? toIsoDate(date) : "";
    setText(toTypedDate(isoDate));
    setIsInvalid(false);
    onChange(isoDate);
  }

  return (
    <div className="mt-0.5 flex flex-col gap-2.5">
      <Input
        id="gpu-quote-start-date"
        aria-label="Start date"
        placeholder="MM/DD/YYYY"
        inputMode="numeric"
        startIcon={<CalendarIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        value={text}
        error={isInvalid}
        aria-invalid={isInvalid || undefined}
        onChange={event => typeDate(event.target.value)}
        onBlur={checkTypedDate}
        className="w-[200px]"
        inputClassName="font-mono"
      />
      {isInvalid && <p className="text-[12.5px] font-medium text-warning">Enter a date from today onward, like {toTypedDate(today)}.</p>}
      <Calendar
        mode="single"
        selected={value ? fromIsoDate(value) : undefined}
        defaultMonth={fromIsoDate(value || today)}
        disabled={{ before: fromIsoDate(today) }}
        onSelect={pickDate}
        showOutsideDays={false}
        className="w-fit rounded-xl border bg-background shadow-sm"
      />
    </div>
  );
}

export function ContactField({ draft, onChange, asksEmail }: DraftFieldProps & { asksEmail: boolean }) {
  return (
    <div className="flex max-w-[360px] flex-col gap-4">
      {asksEmail && (
        <Input
          id="gpu-quote-email"
          type="email"
          label="Email"
          labelClassName="text-[12.5px] font-medium"
          autoComplete="email"
          value={draft.email}
          onChange={event => onChange({ email: event.target.value })}
        />
      )}
      <Input
        id="gpu-quote-phone"
        type="tel"
        label={<OptionalLabel>Phone number</OptionalLabel>}
        labelClassName="text-[12.5px] font-medium"
        placeholder="+1 555 010 0100"
        startIcon={<PhoneIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
        autoComplete="tel"
        maxLength={MAX_CONTACT_FIELD_LENGTH}
        value={draft.phone}
        onChange={event => onChange({ phone: event.target.value })}
      />
      <Input
        id="gpu-quote-company"
        label={<OptionalLabel>Company</OptionalLabel>}
        labelClassName="text-[12.5px] font-medium"
        placeholder="Company or team name"
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

function RareBadge() {
  return (
    <span className="rounded border border-warning/45 px-[5px] font-mono text-[9.5px] font-semibold uppercase leading-[14px] tracking-[0.08em] text-warning">Rare</span>
  );
}

function OptionalLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="font-normal text-muted-foreground">(optional)</span>
    </>
  );
}

function parseTypedDate(text: string): string | null {
  const match = text.trim().match(TYPED_DATE);
  if (!match) return null;

  const [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? toIsoDate(date) : null;
}

function toTypedDate(isoDate: string): string {
  return isoDate ? `${isoDate.slice(5, 7)}/${isoDate.slice(8, 10)}/${isoDate.slice(0, 4)}` : "";
}

function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00`);
}
