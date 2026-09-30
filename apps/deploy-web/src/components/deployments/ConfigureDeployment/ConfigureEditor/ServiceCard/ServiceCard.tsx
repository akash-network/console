import type { FC } from "react";
import { useEffect, useId, useRef } from "react";
import { useFormState } from "react-hook-form";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, FieldErrorMessage, InlineEditInput, useFieldError } from "@akashnetwork/ui/components";
import { BoxIcon, ChevronDownIcon, PencilIcon, TrashIcon } from "lucide-react";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { AdditionalSection } from "../../ConfigurationPane/AdditionalSection/AdditionalSection";
import type { ConfigurationLock } from "../../ConfigurationPane/configurationLock";
import { HardwareSection } from "../../ConfigurationPane/HardwareSection/HardwareSection";
import { ImageSection } from "../../ConfigurationPane/ImageSection/ImageSection";

export const DEPENDENCIES = { ImageSection, HardwareSection, AdditionalSection, InlineEditInput, useFieldError };

type Props = {
  service: ServiceType;
  serviceIndex: number;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  canRemove: boolean;
  onRemove: () => void;
  locked?: ConfigurationLock;
  shouldScrollIntoView?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** The header carries the error tint, because a collapsed card unmounts its body and would otherwise hide an invalid field. */
export const ServiceCard: FC<Props> = ({
  service,
  serviceIndex,
  isExpanded,
  onExpandedChange,
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
        data-invalid={hasError || undefined}
        className="rounded-2xl border bg-muted shadow-[0_4px_12px_-2px_rgba(0,0,0,0.1)] data-[invalid]:border-destructive dark:bg-neutral-900/50"
      >
        <div className="flex h-12 items-center gap-2.5 pl-3.5 pr-2">
          <span
            aria-hidden="true"
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground"
          >
            <BoxIcon className="h-3.5 w-3.5" />
          </span>
          <fieldset disabled={!!locked} className="group m-0 flex min-w-0 flex-1 border-0 p-0 disabled:pointer-events-none">
            <label className="flex min-w-0 cursor-pointer items-center gap-1.5 focus-within:flex-1">
              <div className="grid min-w-0 grid-cols-[minmax(0,min-content)] focus-within:flex-1 focus-within:grid-cols-[minmax(0,1fr)]">
                <span aria-hidden="true" className="invisible col-start-1 row-start-1 h-0 overflow-hidden whitespace-pre font-mono text-sm font-bold uppercase">
                  {title}
                </span>
                <d.InlineEditInput
                  name={`services.${serviceIndex}.title`}
                  label="Service name"
                  suppressErrorMessage
                  errorMessageId={titleErrorId}
                  className="col-start-1 row-start-1 [&_input:focus]:cursor-text [&_input:not(:focus)]:cursor-pointer [&_input:not(:focus)]:uppercase [&_input]:font-bold"
                />
              </div>
              <PencilIcon aria-hidden="true" className="h-3 w-3 shrink-0 group-focus-within:hidden group-disabled:hidden" />
            </label>
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-180"
          >
            <ChevronDownIcon className="h-5 w-5 transition-transform" />
          </CollapsibleTrigger>
        </div>
        {titleError && (
          <div className="px-4 pb-2">
            <FieldErrorMessage id={titleErrorId}>{titleError}</FieldErrorMessage>
          </div>
        )}
        <CollapsibleContent>
          <div className="flex flex-col gap-6 border-t py-4">
            <d.ImageSection serviceIndex={serviceIndex} locked={locked === "all"} />
            <d.HardwareSection serviceIndex={serviceIndex} locked={!!locked} />
            <d.AdditionalSection serviceIndex={serviceIndex} locked={locked} />
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
};
