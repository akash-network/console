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
import { useServices } from "@src/context/ServicesProvider";
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
    useServices: typeof useServices;
  };
};

const logCollectorLabelSchema = z.object({
  POD_LABEL_SELECTOR: z.string()
});

export const LogCollectorControl: FC<Props> = ({ serviceIndex, dependencies: d = { useSdlEnv, useServices } }) => {
  const [isAdding, setIsAdding] = useState(false);
  const { analyticsService } = d.useServices();
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

      const changes: Partial<Pick<ServiceType, "title" | "placementId" | "pricing">> = {};

      if (logCollectorService.title !== nextTitle) {
        changes.title = nextTitle;
      }

      if (targetService.placementId !== logCollectorService.placementId) {
        changes.placementId = targetService.placementId;
      }

      if (targetService.pricing.amount !== logCollectorService.pricing.amount || targetService.pricing.denom !== logCollectorService.pricing.denom) {
        changes.pricing = targetService.pricing;
      }

      if (Object.keys(changes).length > 0) {
        update(logCollectorServiceIndex, {
          ...logCollectorService,
          ...changes
        });
      }
    },
    [
      logCollectorService,
      logCollectorServiceIndex,
      targetService.placementId,
      targetService.pricing.amount,
      targetService.pricing.denom,
      targetService.title,
      update,
      env
    ]
  );

  useThrottledEffect(() => {
    const nextSelector = toPodLabelSelector(targetService);
    if (env.values.POD_LABEL_SELECTOR !== nextSelector) {
      env.setValue("POD_LABEL_SELECTOR", nextSelector);
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
        onCheckedChange={state => {
          const enabled = state === "indeterminate" ? false : state;
          setIsEnabled(enabled);
          analyticsService.track(enabled ? "log_collector_enabled" : "log_collector_disabled", { category: "deployments" });
        }}
        className="ml-4"
        label="Enable log forwarding for this service"
      />{" "}
      {!isAdding && logCollectorService && (
        <div className="mt-4 flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <FormLabel className="mb-1">Log Provider Info</FormLabel>
            <p className="mb-4 text-sm text-muted-foreground">
              We currently only offer support for <strong>Datadog</strong> but will be adding other options in the future.
            </p>

            <FormLabel htmlFor="provider">Provider Selection</FormLabel>
            <Select value="DATADOG" disabled>
              <SelectTrigger id="provider" className="mt-2">
                <SelectValue placeholder="Select Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="DATADOG">Datadog</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <div className="ml-10">
              <DatadogEnvConfig serviceIndex={logCollectorServiceIndex} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <FormLabel className="mb-1">Resources</FormLabel>
            <p className="mb-4 text-sm text-muted-foreground">This runs as a separate service alongside the main deployment for log collection.</p>

            <CpuFormControl control={control} currentService={logCollectorService} serviceIndex={logCollectorServiceIndex} />

            <div className="mt-4">
              <MemoryFormControl control={control} serviceIndex={logCollectorServiceIndex} />
            </div>

            <div className="mt-4">
              <EphemeralStorageFormControl services={allServices} control={control} serviceIndex={logCollectorServiceIndex} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export function isLogCollectorService(service: ServiceType): boolean {
  return !!service.title?.endsWith("-log-collector") && service.image === LOG_COLLECTOR_IMAGE;
}

/**
 * Locates the log-collector paired with `service`. Matches first on the stable id
 * (`<service.id>-log-collector`): the parent title is editable, so an id pairing
 * survives renames where a title pairing would orphan the collector. As a fallback
 * it matches a real collector (by image) whose title is `<service.title>-log-collector`,
 * which covers collectors loaded from an imported SDL — import assigns fresh ids, so
 * the deterministic id no longer matches but the title pairing still holds.
 */
export function findOwnLogCollectorServiceIndex(service: ServiceType, services: ServiceType[]): number {
  return services.findIndex(s => s.id === toLogCollectorId(service) || (isLogCollectorService(s) && s.title === toLogCollectorTitle(service)));
}

/** Builds the `POD_LABEL_SELECTOR` env value that points the collector at the parent service's pods. */
export function toPodLabelSelector(service: ServiceType): string {
  return `akash.network/manifest-service=${service.title}`;
}

export function generateLogCollectorService<T extends ServiceType>(
  targetService: T
): Pick<T, "placementId" | "pricing"> & Omit<ServiceType, "placementId" | "pricing"> {
  return {
    id: toLogCollectorId(targetService),
    title: toLogCollectorTitle(targetService),
    image: LOG_COLLECTOR_IMAGE,
    placementId: targetService.placementId,
    pricing: targetService.pricing,
    env: [
      { key: "PROVIDER", value: "DATADOG" },
      { key: "POD_LABEL_SELECTOR", value: toPodLabelSelector(targetService) },
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

export function toLogCollectorTitle(service: ServiceType): string {
  return `${service.title}-log-collector`;
}

export function toLogCollectorId(service: ServiceType): string {
  return `${service.id}-log-collector`;
}
