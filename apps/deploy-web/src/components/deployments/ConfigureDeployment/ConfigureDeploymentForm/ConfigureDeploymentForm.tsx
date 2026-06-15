"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import debounce from "lodash/debounce";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";

export const DEPENDENCIES = { Layout, NextSeo, ConfigureDeploymentHeader, ConfigureDeploymentPanes, useSnackbar, Snackbar };

/** Delay between a form edit and regenerating the SDL preview. */
const SDL_SYNC_DEBOUNCE_MS = 300;

type Props = {
  initialSdl?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentForm: FC<Props> = ({ initialSdl, dependencies: d = DEPENDENCIES }) => {
  const [initialState] = useState(() => getInitialState(initialSdl));
  const [sdl, setSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialState.selectedServiceId);
  const { enqueueSnackbar } = d.useSnackbar();
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: initialState.values,
    mode: "onChange",
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const services = useWatch({ control: form.control, name: "services" });
  const placements = useWatch({ control: form.control, name: "placements" });
  const selectedPlacementName = resolveSelectedPlacementName(services, placements, selectedServiceId);

  useEffect(
    function notifyOnImportError() {
      if (!initialState.importError) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the deployment" subTitle={initialState.importError} iconVariant="error" />, { variant: "error" });
    },
    [initialState, enqueueSnackbar, d]
  );

  useEffect(
    function syncSdlPreview() {
      const writeSdl = debounce((values: unknown) => {
        setSdl(previous => regenerateSdl(values as SdlBuilderFormValuesType, previous));
      }, SDL_SYNC_DEBOUNCE_MS);
      const subscription = form.watch(values => writeSdl(values));
      return function teardownSdlSync() {
        writeSdl.cancel();
        subscription.unsubscribe();
      };
    },
    [form]
  );

  useEffect(
    function reselectRemovedService() {
      const subscription = form.watch(values => {
        setSelectedServiceId(previous => nextSelectedServiceId(values as SdlBuilderFormValuesType, previous));
      });
      return function teardownReselect() {
        subscription.unsubscribe();
      };
    },
    [form]
  );

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <d.NextSeo title="Configure your deployment" />
      <FormProvider {...form}>
        <div className="px-6 pt-6">
          <d.ConfigureDeploymentHeader />
        </div>
        <div className="mt-6 flex min-h-0 flex-1">
          <d.ConfigureDeploymentPanes
            sdl={sdl}
            selectedServiceId={selectedServiceId}
            selectedPlacementName={selectedPlacementName}
            onSelectService={setSelectedServiceId}
          />
        </div>
      </FormProvider>
    </d.Layout>
  );
};

interface InitialState {
  values: SdlBuilderFormValuesType;
  sdl: string;
  selectedServiceId: string;
  importError?: string;
}

/**
 * Derives the form values, preview SDL, and initial selection from one source so they can never diverge.
 * A carried-in SDL is used only when it imports to a usable deployment (at least one visible service);
 * otherwise — invalid YAML, or a service-less SDL the configure screen can't work with — the screen falls
 * back to a default deployment. This guarantees there is always a service (and placement) to select.
 */
function getInitialState(carriedInSdl: string | undefined): InitialState {
  if (carriedInSdl) {
    try {
      const values = importSimpleSdl(carriedInSdl);
      if (hasVisibleService(values)) {
        return { values, sdl: carriedInSdl, selectedServiceId: seedSelectedServiceId(values) };
      }
    } catch (error) {
      return defaultInitialState(getImportErrorMessage(error));
    }
  }
  return defaultInitialState();
}

/** A fresh default deployment, optionally annotated with the error that made an import unusable. */
function defaultInitialState(importError?: string): InitialState {
  const values = defaultServiceWithPlacement();
  return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values), importError };
}

/** A usable deployment has at least one service the user can configure (log collectors don't count). */
function hasVisibleService(values: SdlBuilderFormValuesType): boolean {
  return values.services.some(service => !isLogCollectorService(service));
}

/**
 * Maps an SDL import failure to a fixed, user-facing message. The raw exception
 * text is intentionally not surfaced: it's parser-internal and untrusted, so
 * keeping it out of the rendered DOM avoids any injection surface.
 */
function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === "YAMLException" || error.name === "CustomValidationError" || error.name === "TemplateValidation")) {
    return "The deployment couldn't be loaded because its SDL is invalid.";
  }
  return "The deployment couldn't be loaded.";
}

/** Picks the first user-visible service to focus when the screen first mounts. `getInitialState` guarantees one exists. */
function seedSelectedServiceId(values: SdlBuilderFormValuesType): string {
  const visible = values.services.find(candidate => !isLogCollectorService(candidate)) ?? values.services[0];
  return visible.id;
}

/** Regenerates the preview SDL, keeping the last good output while the form is mid-edit. */
function regenerateSdl(values: SdlBuilderFormValuesType, previous: string): string {
  try {
    return generateSdl(values);
  } catch {
    return previous;
  }
}

/**
 * Resolves the placement the marketplace is scoped to. There is always a placement and a service, so this
 * returns a name rather than null: it uses the selected service when present, otherwise the first visible
 * service (which also covers the brief window after a removal, before the reselect effect runs), and falls
 * back to the first placement.
 */
function resolveSelectedPlacementName(
  services: SdlBuilderFormValuesType["services"],
  placements: SdlBuilderFormValuesType["placements"],
  selectedServiceId: string
): string {
  const selected = services.find(candidate => candidate.id === selectedServiceId);
  const service = selected ?? services.find(candidate => !isLogCollectorService(candidate));
  const placement = (service && placements.find(candidate => candidate.id === service.placementId)) || placements[0];
  return placement.name;
}

/** Keeps the selection on an existing service, falling back to the first visible one after a removal. */
function nextSelectedServiceId(values: SdlBuilderFormValuesType, previous: string): string {
  const services = values.services ?? [];
  if (services.some(candidate => candidate?.id === previous)) {
    return previous;
  }
  const visible = services.find(candidate => candidate && !isLogCollectorService(candidate as ServiceType)) ?? services[0];
  return visible.id;
}
