"use client";
import { type FC, useCallback, useId, useRef, useState } from "react";
import { Button, Switch } from "@akashnetwork/ui/components";
import { LockIcon, TriangleAlertIcon } from "lucide-react";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { isAskableKey } from "../../../templateMode/buildAskedValues";
import type { AskedValueCustomization } from "../../../templateMode/TemplateModeProvider/TemplateModeProvider";
import { CustomizeAskedValue } from "../CustomizeAskedValue/CustomizeAskedValue";

export const DEPENDENCIES = { CustomizeAskedValue };

const UNASKABLE_KEY_WARNING = "This key can't be asked to the deployer. Rename it with letters, digits and underscores only.";

type Props = {
  rowLabel: string;
  envKey: string;
  isSecret: boolean;
  isAsked: boolean;
  /** Absent while the row has no key yet, since nothing can be asked under an empty key. */
  askedValue: TemplateAskedValue | undefined;
  customized: AskedValueCustomization;
  onAskedChange: (isAsked: boolean) => void;
  onCustomize: (patch: AskedValueCustomization) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const AskTheDeployerControl: FC<Props> = ({
  rowLabel,
  envKey,
  isSecret,
  isAsked,
  askedValue,
  customized,
  onAskedChange,
  onCustomize,
  dependencies: d = DEPENDENCIES
}) => {
  const switchId = useId();
  const panelId = useId();
  const customizeButtonRef = useRef<HTMLButtonElement>(null);
  const [isCustomizing, setCustomizing] = useState(false);

  const finishCustomizing = useCallback(() => {
    setCustomizing(false);
    customizeButtonRef.current?.focus();
  }, []);

  if (envKey !== "" && !isAskableKey(envKey)) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
        <TriangleAlertIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {UNASKABLE_KEY_WARNING}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Switch
          id={switchId}
          size="sm"
          aria-label={`Ask the deployer for ${rowLabel}`}
          checked={isAsked}
          disabled={isSecret || envKey === ""}
          onCheckedChange={onAskedChange}
        />
        <label htmlFor={switchId} className="text-sm font-medium">
          Ask the deployer
        </label>
        {isSecret && <span className="text-xs text-muted-foreground">· always on for secrets</span>}
        {!isAsked && <span className="text-xs text-muted-foreground">· saved as is</span>}
      </div>

      {isSecret && (
        <p className="flex items-center gap-1.5 text-xs text-primary">
          <LockIcon className="h-3 w-3" aria-hidden="true" />
          The deployer provides this; your value isn&apos;t saved.
        </p>
      )}

      {isAsked && askedValue && (
        <>
          <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
            Asked as <b className="font-medium text-foreground">{askedValue.label}</b> · {describeType(askedValue)} · {describeDefault(askedValue)}
            <Button
              ref={customizeButtonRef}
              type="button"
              variant="link"
              size="sm"
              className="ml-2 h-auto p-0 text-xs text-muted-foreground underline"
              aria-expanded={isCustomizing}
              aria-controls={panelId}
              onClick={() => setCustomizing(open => !open)}
            >
              Customize
            </Button>
          </p>
          {isCustomizing && (
            <d.CustomizeAskedValue id={panelId} askedValue={askedValue} customized={customized} onCustomize={onCustomize} onDone={finishCustomizing} />
          )}
        </>
      )}
    </div>
  );
};

function describeType(askedValue: TemplateAskedValue): string {
  switch (askedValue.type) {
    case "text":
      return "Text";
    case "number":
      return "Number";
    case "boolean":
      return "Yes/No";
    case "choice":
      return `Choice of ${askedValue.choices.length}`;
    case "secret":
      return "Secret";
  }
}

function describeDefault(askedValue: TemplateAskedValue): string {
  if (askedValue.type !== "secret" && askedValue.default !== undefined) return "Your value is the default";
  return askedValue.required ? "Required" : "Optional";
}
