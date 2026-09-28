"use client";
import { type FC, useCallback, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  CollapsibleCard,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Field,
  FieldContent,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@akashnetwork/ui/components";
import { SaveIcon, ScrollTextIcon } from "lucide-react";

import { datadogEnvSchema } from "@src/components/sdl/DatadogEnvConfig/DatadogEnvConfig";
import { findOwnLogCollectorServiceIndex } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { useServices } from "@src/context/ServicesProvider";
import { useSdlEnv } from "@src/hooks/useSdlEnv/useSdlEnv";
import type { SdlBuilderFormValuesType } from "@src/types";
import { usePlacementManagerContext } from "../../PlacementManagerProvider/PlacementManagerProvider";
import { syncLogCollectors } from "../../useSyncLogCollectors/useSyncLogCollectors";
import { logsTooltip } from "../cardTooltips";
import { ComputeResourcesCard } from "../ComputeResourcesCard/ComputeResourcesCard";

export const DEPENDENCIES = {
  CollapsibleCard,
  DialogV2,
  DialogV2Content,
  DialogV2Header,
  DialogV2Title,
  DialogV2Description,
  DialogV2Body,
  DialogV2Footer,
  ComputeResourcesCard,
  usePlacementManagerContext,
  useSdlEnv,
  useServices
};

type Props = {
  serviceIndex: number;
  /** While the pane is locked the dialog still opens for viewing but its inputs and Save are disabled. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * "Logs" card. A header switch enables/disables log forwarding for the selected
 * service; the settings live in a modal. Like the legacy {@link LogCollectorControl},
 * enabling appends a separate `-log-collector` sibling service to `services[]`
 * (Datadog provider, seeded default resources) that ships the parent service's logs.
 * The collector is added and removed through the shared placement manager, the single owner
 * of the services array, and the form keeps its title/placement/pricing in sync with the parent.
 *
 * Trigger behavior:
 * - Off → flip the switch (or click the header): the collector is added straight away
 *   and the modal opens. **Cancel** removes it again (back to off); **Save** keeps it.
 * - On → flip the switch: the collector is removed (no modal).
 * - On → click the header: the modal opens to edit; **Save** applies, **Cancel** reverts
 *   to the values captured when it opened.
 *
 * Only Datadog is supported as a provider; its Regional URL (`DD_SITE`) and API key
 * (`DD_API_KEY`) are edited in the modal and stored on the sibling service's env. The
 * collector's CPU/memory/storage are editable through the shared {@link ComputeResourcesCard}.
 */
export const LogsCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, setValue, reset, trigger, formState } = useFormContext<SdlBuilderFormValuesType>();
  const { analyticsService } = d.useServices();
  const { addLogCollector, removeLogCollector } = d.usePlacementManagerContext();
  const services = useWatch({ control, name: "services" }) ?? [];
  const targetService = services[serviceIndex];
  const collectorIndex = useMemo(
    () => (targetService ? findOwnLogCollectorServiceIndex(targetService, services as SdlBuilderFormValuesType["services"]) : -1),
    [services, targetService]
  );
  const isEnabled = collectorIndex !== -1;
  const { isSubmitted } = formState;
  /**
   * The collector service is hidden (no tab, modal closed), so surface its validation errors on this
   * card. Both this and the card's own Save/Cancel re-validation are deferred until after the first
   * submit (`isSubmitted`), matching the form's `onSubmit` mode — otherwise closing the modal would
   * light up the card and its fields before the user ever submits.
   */
  const hasCollectorErrors = isSubmitted && collectorIndex !== -1 && !!formState.errors.services?.[collectorIndex];

  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SdlBuilderFormValuesType | null>(null);

  const addCollector = useCallback(() => {
    addLogCollector(getValues(`services.${serviceIndex}.id`) as string);
  }, [addLogCollector, getValues, serviceIndex]);

  const removeCollector = useCallback(() => {
    removeLogCollector(getValues(`services.${serviceIndex}.id`) as string);
  }, [removeLogCollector, getValues, serviceIndex]);

  /** Snapshots the form, enables forwarding, and opens the settings modal. */
  const enableAndOpen = useCallback(() => {
    setSnapshot(structuredClone(getValues()));
    addCollector();
    setOpen(true);
  }, [getValues, addCollector]);

  /** Snapshots the form and opens the settings modal for an already-enabled card. */
  const openForEdit = useCallback(() => {
    setSnapshot(structuredClone(getValues()));
    setOpen(true);
  }, [getValues]);

  /**
   * Header switch: enabling (from off) adds the collector and opens the modal so it
   * can be configured immediately; disabling (from on) just removes it, no modal.
   */
  const handleToggle = useCallback(
    (checked: boolean) => {
      if (checked) {
        enableAndOpen();
      } else {
        removeCollector();
        analyticsService.track("log_collector_disabled", { category: "deployments" });
      }
    },
    [enableAndOpen, removeCollector, analyticsService]
  );

  /**
   * Header click (title/chevron): an enabled card opens for editing; a disabled card
   * enables and opens (same as flipping the switch). While locked nothing is mutated —
   * an enabled card still opens read-only and a disabled one stays put.
   */
  const handleHeaderClick = useCallback(() => {
    if (isEnabled) {
      openForEdit();
    } else if (!locked) {
      enableAndOpen();
    }
  }, [isEnabled, locked, openForEdit, enableAndOpen]);

  const handleCancel = useCallback(() => {
    if (snapshot) {
      reset(snapshot, { keepErrors: true });
      if (isSubmitted) void trigger("services");
    }
    setOpen(false);
  }, [reset, trigger, snapshot, isSubmitted]);

  const handleSave = useCallback(() => {
    const enabledThisSession = !!snapshot && findOwnLogCollectorServiceIndex(snapshot.services[serviceIndex], snapshot.services) === -1;

    syncLogCollectors(getValues("services"), setValue);

    reset(getValues(), { keepDirty: true, keepErrors: true });
    if (isSubmitted) void trigger("services");
    setOpen(false);

    if (enabledThisSession) {
      analyticsService.track("log_collector_enabled", { category: "deployments" });
    }
  }, [getValues, setValue, reset, trigger, snapshot, serviceIndex, analyticsService, isSubmitted]);

  return (
    <>
      <d.CollapsibleCard
        locked={locked}
        title="Logs"
        icon={<ScrollTextIcon className="h-4 w-4" />}
        infoTooltip={logsTooltip}
        isToggled={isEnabled}
        onToggle={handleToggle}
        toggleAriaLabel="Enable log forwarding"
        toggleDisabled={locked}
        className={hasCollectorErrors ? "border-destructive dark:border-destructive" : undefined}
        summary={isEnabled ? <span className="text-sm text-muted-foreground">Datadog</span> : undefined}
        onHeaderClick={handleHeaderClick}
      />

      <d.DialogV2
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) handleCancel();
        }}
      >
        <d.DialogV2Content className="max-w-lg" aria-describedby="logs-description">
          <d.DialogV2Header>
            <d.DialogV2Title>Log forwarding</d.DialogV2Title>
            <d.DialogV2Description id="logs-description">
              Forward this service's logs to a third-party monitoring provider. A separate collector service is added to your deployment.
            </d.DialogV2Description>
          </d.DialogV2Header>

          <d.DialogV2Body className="flex flex-col gap-4">
            <fieldset disabled={locked} className="contents">
              {collectorIndex !== -1 && (
                <>
                  <DatadogFields serviceIndex={collectorIndex} dependencies={d} />

                  <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-medium">Resources</p>
                      <p className="text-sm text-muted-foreground">The collector runs as a separate service alongside your deployment.</p>
                    </div>
                    <d.ComputeResourcesCard serviceIndex={collectorIndex} locked={locked} />
                  </div>
                </>
              )}
            </fieldset>
          </d.DialogV2Body>

          <d.DialogV2Footer className="flex items-center justify-end">
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={locked}>
              Save
              <SaveIcon className="ml-2 h-4 w-4" />
            </Button>
          </d.DialogV2Footer>
        </d.DialogV2Content>
      </d.DialogV2>
    </>
  );
};

type DatadogFieldsProps = {
  serviceIndex: number;
  dependencies: typeof DEPENDENCIES;
};

const DatadogFields: FC<DatadogFieldsProps> = ({ serviceIndex, dependencies: d }) => {
  const env = d.useSdlEnv({ serviceIndex, schema: datadogEnvSchema });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <Field className="gap-2">
        <FieldLabel htmlFor={`logs-provider-${serviceIndex}`}>Provider</FieldLabel>
        <FieldContent>
          <Select value="DATADOG" disabled>
            <SelectTrigger id={`logs-provider-${serviceIndex}`} aria-label="Log provider" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DATADOG">Datadog</SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`logs-dd-site-${serviceIndex}`}>Regional URL</FieldLabel>
        <FieldContent>
          <Input
            id={`logs-dd-site-${serviceIndex}`}
            aria-label="Datadog regional URL"
            placeholder="e.g. datadoghq.eu"
            value={env.values.DD_SITE ?? ""}
            onChange={event => env.setValue("DD_SITE", event.target.value)}
            error={!!env.errors.DD_SITE}
            inputClassName="h-9"
          />
          {env.errors.DD_SITE && <p className="text-sm text-destructive">{env.errors.DD_SITE}</p>}
        </FieldContent>
      </Field>

      <Field className="gap-2">
        <FieldLabel htmlFor={`logs-dd-api-key-${serviceIndex}`}>Provider API key</FieldLabel>
        <FieldContent>
          <Input
            id={`logs-dd-api-key-${serviceIndex}`}
            aria-label="Datadog API key"
            type="password"
            placeholder="Paste the API key from your provider"
            value={env.values.DD_API_KEY ?? ""}
            onChange={event => env.setValue("DD_API_KEY", event.target.value)}
            error={!!env.errors.DD_API_KEY}
            inputClassName="h-9"
          />
          {env.errors.DD_API_KEY && <p className="text-sm text-destructive">{env.errors.DD_API_KEY}</p>}
        </FieldContent>
      </Field>
    </div>
  );
};
