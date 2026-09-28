import type { FC } from "react";
import { useEffect, useId, useRef } from "react";
import { useFormState } from "react-hook-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, FieldErrorMessage, InlineEditInput, useFieldError } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from "lucide-react";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { AdditionalSection } from "../../ConfigurationPane/AdditionalSection/AdditionalSection";
import type { ConfigurationLock } from "../../ConfigurationPane/configurationLock";
import { HardwareSection } from "../../ConfigurationPane/HardwareSection/HardwareSection";
import { ImageSection } from "../../ConfigurationPane/ImageSection/ImageSection";
import { ConfigStatusIcon } from "../../DeploymentPane/ConfigStatusIcon/ConfigStatusIcon";

export const DEPENDENCIES = { ImageSection, HardwareSection, AdditionalSection, InlineEditInput, useFieldError };

type Props = {
  service: ServiceType;
  serviceIndex: number;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  isConfigured: boolean;
  canRemove: boolean;
  onRemove: () => void;
  locked?: ConfigurationLock;
  shouldScrollIntoView?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** The header carries the status and the error tint, because a collapsed card unmounts its body and would otherwise hide an invalid field. */
export const ServiceCard: FC<Props> = ({
  service,
  serviceIndex,
  isExpanded,
  onExpandedChange,
  isConfigured,
  canRemove,
  onRemove,
  locked,
  shouldScrollIntoView = false,
  dependencies: d = DEPENDENCIES
}) => {
  const { errors } = useFormState<SdlBuilderFormValuesType>({ name: `services.${serviceIndex}` });
  const hasError = !!errors.services?.[serviceIndex];
  const { error: titleError } = d.useFieldError(`services.${serviceIndex}.title`);
  const cardRef = useRef<HTMLElement>(null);
  const titleErrorId = useId();
  const title = service.title;

  useEffect(
    function scrollAddedServiceIntoView() {
      if (shouldScrollIntoView) cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [shouldScrollIntoView]
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange} asChild>
      <section
        ref={cardRef}
        aria-label={`${title} service`}
        className={cn("rounded-lg border bg-card", hasError ? "border-destructive" : "border-zinc-300 dark:border-zinc-700")}
      >
        <div className="flex h-12 items-center gap-2 px-4">
          <ConfigStatusIcon status={isConfigured ? "complete" : "incomplete"} />
          <fieldset disabled={!!locked} className="m-0 min-w-0 flex-1 border-0 p-0 disabled:pointer-events-none">
            <d.InlineEditInput name={`services.${serviceIndex}.title`} label="Service name" suppressErrorMessage errorMessageId={titleErrorId} />
          </fieldset>
          {canRemove && !locked && (
            <button
              type="button"
              aria-label={`Remove ${title}`}
              onClick={onRemove}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
          <CollapsibleTrigger
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
          </CollapsibleTrigger>
        </div>
        {titleError && (
          <div className="px-4 pb-2">
            <FieldErrorMessage id={titleErrorId}>{titleError}</FieldErrorMessage>
          </div>
        )}
        <CollapsibleContent className="flex flex-col gap-6 border-t border-zinc-300 py-4 dark:border-zinc-700">
          <d.ImageSection serviceIndex={serviceIndex} locked={locked === "all"} />
          <d.HardwareSection serviceIndex={serviceIndex} locked={!!locked} />
          <d.AdditionalSection serviceIndex={serviceIndex} locked={locked} />
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
