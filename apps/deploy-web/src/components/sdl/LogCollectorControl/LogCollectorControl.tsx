import type { FC } from "react";
import { useEffect, useState } from "react";
import { useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import {
  CheckboxWithLabel,
  CustomTooltip,
  FormLabel,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";
import { atom, useAtom } from "jotai";
import { z } from "zod";

import { CpuFormControl } from "@src/components/sdl/CpuFormControl";
import { DatadogEnvConfig } from "@src/components/sdl/DatadogEnvConfig/DatadogEnvConfig";
import { EphemeralStorageFormControl } from "@src/components/sdl/EphemeralStorageFormControl";
import { MemoryFormControl } from "@src/components/sdl/MemoryFormControl";
import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import { useSdlEnv } from "@src/hooks/useSdlEnv/useSdlEnv";
import { useThrottledEffect } from "@src/hooks/useThrottledEffect/useThrottledEffect";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

const switchStore = atom<Record<string, boolean>>({});
const useSwitch = (key: string, initial: boolean): [boolean, (value: boolean) => void] => {
  const [prev, set] = useAtom(switchStore);
  return [prev[key] ?? initial, (value: boolean) => set({ ...prev, [key]: value })];
};

type Props = {
  serviceIndex: number;
  dependencies?: {
    useSdlEnv: typeof useSdlEnv;
  };
};

const logCollectorLabelSchema = z.object({
  POD_LABEL_SELECTOR: z.string()
});

export const LogCollectorControl: FC<Props> = ({ serviceIndex, dependencies: d = { useSdlEnv } }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { watch, control } = useFormContext<SdlBuilderFormValuesType>();
  const { append, remove, update } = useFieldArray({ name: `services` });
  const allServices = watch(`services`);
  const targetService = allServices[serviceIndex];
  const logCollectorServiceIndex = useMemo(
    () => allServices.findIndex(service => targetService && service?.title === toLogCollectorTitle(targetService)),
    [allServices, targetService]
  );
  const logCollectorService = useMemo(() => allServices[logCollectorServiceIndex], [allServices, logCollectorServiceIndex]);
  const [isEnabled, setIsEnabled] = useSwitch(targetService.title, logCollectorServiceIndex !== -1);
  const env = d.useSdlEnv({ serviceIndex: logCollectorServiceIndex, schema: logCollectorLabelSchema });

  useThrottledEffect(
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
    [logCollectorService, logCollectorServiceIndex, targetService.placement.name, targetService.title, update, env]
  );

  useThrottledEffect(() => {
    const nextTitle = `akash.network/manifest-service=${targetService.title}`;
    if (env.values.POD_LABEL_SELECTOR !== nextTitle) {
      env.setValue("POD_LABEL_SELECTOR", nextTitle);
    }
  }, [env, targetService.title]);

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
      {!isAdding && logCollectorService && (
        <div>
          <div>
            <FormLabel htmlFor="provider" className="mb-2 mt-4 flex items-center">
              Provider
              <CustomTooltip title={<>We are actively working on adding support for more providers.</>}>
                <InfoCircle className="ml-2 text-xs text-muted-foreground" />
              </CustomTooltip>
            </FormLabel>
            <Select value="DATADOG" disabled>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="DATADOG">Datadog</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <DatadogEnvConfig serviceIndex={logCollectorServiceIndex} />

          <div className="mt-4">
            <CpuFormControl control={control} currentService={logCollectorService} serviceIndex={logCollectorServiceIndex} />
          </div>

          <div className="mt-4">
            <MemoryFormControl control={control} serviceIndex={logCollectorServiceIndex} />
          </div>

          <div className="mt-4">
            <EphemeralStorageFormControl services={allServices} control={control} serviceIndex={logCollectorServiceIndex} />
          </div>
        </div>
      )}
    </>
  );
};

export function isLogCollectorService(service: ServiceType): boolean {
  return service.title.endsWith("-log-collector") && service.image === LOG_COLLECTOR_IMAGE;
}

export function findOwnLogCollectorServiceIndex(service: ServiceType, services: ServiceType[]): number {
  return services.findIndex(s => s.title === toLogCollectorTitle(service));
}

function generateLogCollectorService<T extends ServiceType>(targetService: T): Pick<T, "placement"> & Omit<ServiceType, "placement"> {
  return {
    id: toLogCollectorId(targetService),
    title: toLogCollectorTitle(targetService),
    image: LOG_COLLECTOR_IMAGE,
    placement: targetService.placement,
    env: [
      { key: "PROVIDER", value: "DATADOG" },
      { key: "POD_LABEL_SELECTOR", value: `akash.network/manifest-service=${targetService.title}` },
      { key: "DD_API_KEY", value: "" },
      { key: "DD_SITE", value: "" }
    ],
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
