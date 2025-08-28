import type { FC } from "react";
import { useEffect, useState } from "react";
import { useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { CheckboxWithLabel, CustomTooltip } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";
import { atom, useAtom } from "jotai";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

const switchStore = atom<Record<string, boolean>>({});
const useSwitch = (key: string, initial: boolean): [boolean, (value: boolean) => void] => {
  const [prev, set] = useAtom(switchStore);
  return [prev[key] ?? initial, (value: boolean) => set({ ...prev, [key]: value })];
};

type Props = {
  serviceIndex: number;
};

export const LogCollectorControl: FC<Props> = ({ serviceIndex }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { watch } = useFormContext<SdlBuilderFormValuesType>();
  const { append, remove, update } = useFieldArray({ name: `services` });
  const allServices = watch(`services`);
  const targetService = allServices[serviceIndex];
  const logCollectorServiceIndex = useMemo(
    () => allServices.findIndex(service => targetService && service?.title === toLogCollectorTitle(targetService)),
    [allServices, targetService]
  );
  const logCollectorService = useMemo(() => allServices[logCollectorServiceIndex], [allServices, logCollectorServiceIndex]);
  const [isEnabled, setIsEnabled] = useSwitch(targetService.title, logCollectorServiceIndex !== -1);

  useEffect(
    function trackTargetNameAndPlacement() {
      if (logCollectorServiceIndex === -1) {
        return;
      }
      const nextTitle = toLogCollectorTitle(targetService);

      const changes: Partial<Pick<ServiceType, "title" | "placement">> = {};

      if (logCollectorService.title !== nextTitle) {
        changes.title = nextTitle;
      }

      if (targetService.placement.name !== logCollectorService.placement.name) {
        changes.placement = targetService.placement;
      }

      if (Object.keys(changes).length > 0) {
        update(logCollectorServiceIndex, {
          ...logCollectorService,
          ...changes
        });
      }
    },
    [logCollectorService, logCollectorServiceIndex, targetService.placement.name, targetService.title, update]
  );

  useEffect(
    function addWhenEnabledAndGenerated() {
      if (isEnabled && logCollectorServiceIndex === -1) {
        setIsAdding(true);
        append(logCollectorService || generateLogCollectorService(targetService));
      }
    },
    [isEnabled, logCollectorService, allServices, logCollectorServiceIndex, append, remove, setIsAdding, targetService]
  );

  useEffect(
    function finalizeAdding() {
      if (isAdding && logCollectorServiceIndex !== -1) {
        setIsAdding(false);
      }
    },
    [isAdding, logCollectorServiceIndex]
  );

  useEffect(
    function removeWhenDisabled() {
      if (!isEnabled && !isAdding && logCollectorServiceIndex !== -1) {
        remove(logCollectorServiceIndex);
      }
    },
    [isEnabled, logCollectorService, allServices, logCollectorServiceIndex, append, remove, isAdding]
  );

  return (
    <>
      <div className="mb-2 flex items-center">
        <strong className="text-sm">Log Forwarding</strong>
        <CustomTooltip
          title={
            <>
              Log forwarding adds an additional service that collects logs from the primary service and forwards them to third-party monitoring services like
              Datadog.
            </>
          }
        >
          <InfoCircle className="ml-2 text-xs text-muted-foreground" />
        </CustomTooltip>
      </div>
      <CheckboxWithLabel
        checked={isEnabled}
        onCheckedChange={state => setIsEnabled(state === "indeterminate" ? false : state)}
        className="ml-4"
        label="Enable log forwarding for this service"
      />{" "}
    </>
  );
};

const IMAGE = "ghcr.io/akash-network/log-collector:1.7.0";

export function isLogCollectorService(service: ServiceType): boolean {
  return service.title.endsWith("-log-collector") && service.image === IMAGE;
}

export function findOwnLogCollectorServiceIndex(service: ServiceType, services: ServiceType[]): number {
  return services.findIndex(s => s.title === toLogCollectorTitle(service));
}

function generateLogCollectorService<T extends ServiceType>(targetService: T): Pick<T, "placement"> & Omit<ServiceType, "placement"> {
  return {
    id: toLogCollectorId(targetService),
    title: toLogCollectorTitle(targetService),
    image: IMAGE,
    placement: targetService.placement,
    profile: {
      cpu: 0.1,
      ram: 256,
      ramUnit: "Mi",
      storage: [
        {
          size: 512,
          unit: "Mi",
          isPersistent: true
        }
      ],
      hasGpu: false,
      gpu: 0
    },
    expose: [],
    count: 1
  };
}

function toLogCollectorTitle(service: ServiceType): string {
  return `${service.title}-log-collector`;
}

function toLogCollectorId(service: ServiceType): string {
  return `${service.id}-log-collector`;
}
