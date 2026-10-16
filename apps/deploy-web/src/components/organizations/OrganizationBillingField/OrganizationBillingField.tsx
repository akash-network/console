"use client";
import type { FC, Ref } from "react";
import { useId } from "react";
import { Label, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import type { LucideIcon } from "lucide-react";
import { Clock, CreditCard } from "lucide-react";

import type { NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { NewCardFields } from "@src/components/organizations/NewCardFields/NewCardFields";

export const DEPENDENCIES = { NewCardFields };

export type BillingChoice = "card" | "later";

type Props = {
  organizationName: string;
  choice: BillingChoice | undefined;
  onChoiceChange: (choice: BillingChoice) => void;
  cardRef: Ref<NewCardHandle>;
  onCardCompleteChange: (isComplete: boolean) => void;
  disabled: boolean;
  dependencies?: typeof DEPENDENCIES;
};

export const OrganizationBillingField: FC<Props> = ({
  organizationName,
  choice,
  onChoiceChange,
  cardRef,
  onCardCompleteChange,
  disabled,
  dependencies: d = DEPENDENCIES
}) => {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const hintId = `${fieldId}-hint`;
  const organization = organizationName || "the organization";

  return (
    <div className="flex flex-col gap-1.5">
      <Label id={labelId}>Billing</Label>
      <p id={hintId} className="text-xs text-muted-foreground">
        {organizationName || "The organization"} gets its own balance and payment method, separate from your personal account.
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        aria-describedby={hintId}
        value={choice ?? ""}
        onValueChange={value => onChoiceChange(value as BillingChoice)}
        disabled={disabled}
        className="gap-0 overflow-hidden rounded-[10px] border border-border"
      >
        <BillingOption id={`${fieldId}-card`} value="card" icon={CreditCard} title="Add a new card" description={`Saved to ${organization} only`} />
        {choice === "card" && (
          <div className="bg-muted/40 px-3.5 pb-3.5 pt-0.5">
            <d.NewCardFields ref={cardRef} onCompleteChange={onCardCompleteChange} />
          </div>
        )}
        <BillingOption
          id={`${fieldId}-later`}
          value="later"
          icon={Clock}
          title="Set up later"
          description={`No one in ${organization} can deploy until it has a payment method. You can add one in Billing.`}
        />
      </RadioGroup>
    </div>
  );
};

type BillingOptionProps = { id: string; value: BillingChoice; icon: LucideIcon; title: string; description: string };

const BillingOption: FC<BillingOptionProps> = ({ id, value, icon: Icon, title, description }) => (
  <Label
    htmlFor={id}
    className="flex cursor-pointer items-center gap-3 border-t border-border px-3.5 py-2.5 font-normal first:border-t-0 has-[[data-state=checked]]:bg-muted/40"
  >
    <RadioGroupItem id={id} value={value} className="shrink-0" />
    <span className="flex h-7 w-[42px] shrink-0 items-center justify-center rounded-md border border-border bg-background">
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
    </span>
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs leading-[17px] text-muted-foreground">{description}</span>
    </span>
  </Label>
);
