import type { FC, ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { AdditionalSection } from "./AdditionalSection/AdditionalSection";
import { HardwareSection } from "./HardwareSection/HardwareSection";
import { ImageSection } from "./ImageSection/ImageSection";
import type { ConfigurationLock } from "./configurationLock";

export const DEPENDENCIES = { ImageSection, HardwareSection, AdditionalSection };

type Props = {
  selectedServiceId: string;
  /**
   * How much of the pane is locked. `"onchain"` locks only the cards baked into the deployment (resources, placement,
   * ports, …) while the manifest-only image/env/command cards stay editable; `"all"` locks every card while a
   * create/close/deploy is in flight. Absent leaves everything editable. The lock banner itself is rendered
   * once across both spec panes by the parent. See {@link ConfigurationLock}.
   */
  locked?: ConfigurationLock;
  /** Rendered at the trailing edge of the pane header, e.g. the SDL import/export menu. */
  actions?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Renders the configuration cards for the selected service. The per-service
 * subtree is keyed by `selectedServiceId` so switching services remounts the
 * cards: their `useController`/`useFieldError` hooks bind to a fixed service
 * index per mount rather than reacting to a changing one, which would otherwise
 * leave the previous service's values and errors on screen.
 */
export const ConfigurationPane: FC<Props> = ({ selectedServiceId, locked, actions, dependencies: d = DEPENDENCIES }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services" });
  const services = Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : [];
  const selectedServiceIndex = services.findIndex(service => service.id === selectedServiceId);
  const selectedService = selectedServiceIndex >= 0 ? services[selectedServiceIndex] : undefined;

  return (
    <section aria-labelledby="configure-configuration-pane-heading" className="col-start-2 row-start-1 row-end-4 grid h-full min-h-0 grid-rows-subgrid">
      <header className="flex h-[52px] items-center gap-2 border-b border-l border-zinc-300 px-4 dark:border-zinc-700">
        <h2 id="configure-configuration-pane-heading" className="shrink-0 font-mono text-sm font-medium uppercase text-muted-foreground">
          2. Configuration
        </h2>
        {selectedService && <span className="min-w-0 truncate font-mono text-sm font-semibold text-blue-500">• {selectedService.title}</span>}
        {actions ? <div className="ml-auto shrink-0">{actions}</div> : null}
      </header>
      <div className="row-start-3 min-h-0 overflow-y-auto border-l border-zinc-300 py-4 dark:border-zinc-700">
        {selectedServiceIndex >= 0 && (
          <div key={selectedServiceId} className="flex flex-col gap-6">
            <d.ImageSection serviceIndex={selectedServiceIndex} locked={locked === "all"} />
            <d.HardwareSection serviceIndex={selectedServiceIndex} locked={!!locked} />
            <d.AdditionalSection serviceIndex={selectedServiceIndex} locked={locked} />
          </div>
        )}
      </div>
    </section>
  );
};
