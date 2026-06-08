"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAtomValue } from "jotai";
import debounce from "lodash/debounce";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import sdlStore from "@src/store/sdlStore";
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
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeployment: FC<Props> = ({ dependencies: d = DEPENDENCIES }) => {
  const deploySdl = useAtomValue(sdlStore.deploySdl);
  const [initialState] = useState(() => getInitialState(deploySdl?.content));
  const [sdl, setSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(initialState.selectedServiceId);
  const { enqueueSnackbar } = d.useSnackbar();
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: initialState.values,
    mode: "onChange",
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });

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
          <d.ConfigureDeploymentPanes sdl={sdl} selectedServiceId={selectedServiceId} onSelectService={setSelectedServiceId} />
        </div>
      </FormProvider>
    </d.Layout>
  );
};

interface InitialState {
  values: SdlBuilderFormValuesType;
  sdl: string;
  selectedServiceId: string | null;
  importError?: string;
}

/**
 * Derives the form values, preview SDL, and initial selection from one source
 * so they can never diverge. A parseable carried-in template keeps its exact
 * SDL text for the preview; if it can't be imported the screen falls back to a
 * default deployment and reports `importError` so the failure is surfaced
 * rather than silently swallowed.
 */
function getInitialState(carriedInSdl: string | undefined): InitialState {
  if (carriedInSdl) {
    try {
      const values = importSimpleSdl(carriedInSdl);
      return { values, sdl: carriedInSdl, selectedServiceId: seedSelectedServiceId(values) };
    } catch (error) {
      const values = defaultServiceWithPlacement();
      return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values), importError: getImportErrorMessage(error) };
    }
  }
  const values = defaultServiceWithPlacement();
  return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values) };
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

/** Picks the first user-visible service to focus when the screen first mounts. */
function seedSelectedServiceId(values: SdlBuilderFormValuesType): string | null {
  return values.services.find(service => !isLogCollectorService(service))?.id ?? null;
}

/** Regenerates the preview SDL, keeping the last good output while the form is mid-edit. */
function regenerateSdl(values: SdlBuilderFormValuesType, previous: string): string {
  try {
    return generateSdl(values);
  } catch {
    return previous;
  }
}

/** Keeps the selection on an existing service, falling back to the first visible one after a removal. */
function nextSelectedServiceId(values: SdlBuilderFormValuesType, previous: string | null): string | null {
  const services = values.services ?? [];
  if (previous && services.some(service => service?.id === previous)) {
    return previous;
  }
  return services.find(service => service && !isLogCollectorService(service as ServiceType))?.id ?? null;
}
