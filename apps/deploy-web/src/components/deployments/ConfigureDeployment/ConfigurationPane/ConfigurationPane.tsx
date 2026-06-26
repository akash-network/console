import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { PaneLockBanner } from "../PaneLockBanner/PaneLockBanner";
import { AdditionalSection } from "./AdditionalSection/AdditionalSection";
import { HardwareSection } from "./HardwareSection/HardwareSection";

export const DEPENDENCIES = { HardwareSection, AdditionalSection };

type Props = {
  selectedServiceId: string;
  /** While quotes are active the configuration controls are disabled and a lock banner is shown. */
  locked?: boolean;
  isClosing?: boolean;
  onCancelAndEdit?: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Renders the configuration cards for the selected service. The per-service
 * subtree is keyed by `selectedServiceId` so switching services remounts the
 * cards: their `useController`/`useFieldError` hooks bind to a fixed service
 * index per mount rather than reacting to a changing one, which would otherwise
 * leave the previous service's values and errors on screen.
 */
export const ConfigurationPane: FC<Props> = ({ selectedServiceId, locked = false, isClosing = false, onCancelAndEdit, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services" });
  const services = Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : [];
  const selectedServiceIndex = services.findIndex(service => service.id === selectedServiceId);
  const selectedService = selectedServiceIndex >= 0 ? services[selectedServiceIndex] : undefined;

  return (
    <section aria-labelledby="configure-configuration-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="hidden h-[52px] shrink-0 items-center gap-2 border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-configuration-pane-heading" className="shrink-0 font-mono text-sm font-medium uppercase text-muted-foreground">
          2. Configuration
        </h2>
        {selectedService && <span className="min-w-0 truncate font-mono text-sm font-semibold text-blue-500">• {selectedService.title}</span>}
      </header>
      {locked ? <PaneLockBanner onCancelAndEdit={onCancelAndEdit ?? noop} isClosing={isClosing} /> : null}
      <div className="flex-1 overflow-y-auto py-4">
        {selectedServiceIndex >= 0 && (
          <div key={selectedServiceId} className="flex flex-col gap-6">
            <d.HardwareSection serviceIndex={selectedServiceIndex} locked={locked} />
            <d.AdditionalSection serviceIndex={selectedServiceIndex} locked={locked} />
          </div>
        )}
      </div>
    </section>
  );
};

/** Fallback when the pane is locked without a cancel handler (defensive; the parent always supplies one while locked). */
function noop() {}
