import type { FC } from "react";
import { useFormContext, useWatch } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";

type Props = {
  selectedServiceId: string;
};

export const ConfigurationPane: FC<Props> = ({ selectedServiceId }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const watchedServices = useWatch<SdlBuilderFormValuesType>({ control, name: "services" });
  const services = Array.isArray(watchedServices) ? (watchedServices as SdlBuilderFormValuesType["services"]) : [];
  const selectedService = services.find(service => service.id === selectedServiceId);

  return (
    <section aria-labelledby="configure-configuration-pane-heading" className="flex h-full min-h-0 flex-col">
      <header className="hidden h-[52px] shrink-0 items-center gap-2 border-b border-zinc-300 px-4 md:flex dark:border-zinc-700">
        <h2 id="configure-configuration-pane-heading" className="font-mono text-sm font-medium uppercase text-muted-foreground">
          2. Configuration
        </h2>
        {selectedService && <span className="truncate font-mono text-sm text-foreground">{selectedService.title}</span>}
      </header>
      <div className="flex-1 overflow-y-auto" />
    </section>
  );
};
