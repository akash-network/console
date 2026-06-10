"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Form, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { NavArrowRight } from "iconoir-react";
import { useAtom } from "jotai";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSnackbar } from "notistack";

import { SimpleServiceFormControl } from "@src/components/sdl/SimpleServiceFormControl";
import { USER_TEMPLATE_CODE } from "@src/config/deploy.config";
import { useServices } from "@src/context/ServicesProvider";
import useFormPersist from "@src/hooks/useFormPersist";
import { useSdlServiceManager } from "@src/hooks/useSdlServiceManager/useSdlServiceManager";
import { useGpuModels } from "@src/queries/useGpuQuery";
import sdlStore from "@src/store/sdlStore";
import type { ITemplate, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { RouteStep } from "@src/types/route-steps.type";
import { memoryUnits, storageUnits } from "@src/utils/akash/units";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { UrlService } from "@src/utils/urlUtils";
import { ImportSdlModal } from "./ImportSdlModal";
import { PreviewSdl } from "./PreviewSdl";
import { SaveTemplateModal } from "./SaveTemplateModal";

export const SimpleSDLBuilderForm: React.FunctionComponent = () => {
  const { consoleApiHttpClient, analyticsService } = useServices();
  const [error, setError] = useState(null);
  const [templateMetadata, setTemplateMetadata] = useState<ITemplate | null>(null);
  const [serviceCollapsed, setServiceCollapsed] = useState<number[]>([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isImportingSdl, setIsImportingSdl] = useState(false);
  const [isPreviewingSdl, setIsPreviewingSdl] = useState(false);
  const [sdlResult, setSdlResult] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const [sdlBuilderSdl, setSdlBuilderSdl] = useAtom(sdlStore.sdlBuilderSdl);
  const { data: gpuModels } = useGpuModels();
  const { enqueueSnackbar } = useSnackbar();
  const initialValues = useMemo(() => defaultServiceWithPlacement(), []);
  const form = useForm<SdlBuilderFormValuesType>({
    resolver: zodResolver(SdlBuilderFormValuesSchema),
    defaultValues: initialValues
  });
  const { handleSubmit, reset, control, trigger, watch, setValue } = form;
  const { clear: clearFormStorage } = useFormPersist("sdl-builder-form", {
    watch,
    setValue,
    defaultValues: initialValues,
    storage: typeof window === "undefined" ? undefined : window.localStorage
  });
  const { services: _services } = watch();
  const serviceManager = useSdlServiceManager({ control });
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateQueryId = searchParams?.get("id");

  useEffect(() => {
    if (sdlBuilderSdl && sdlBuilderSdl.services) {
      if (sdlBuilderSdl.placements) {
        setValue("placements", sdlBuilderSdl.placements);
      }
      setValue("services", sdlBuilderSdl.services);
    }
  }, []);

  // Load the template from query string on mount
  useEffect(() => {
    if ((templateQueryId && !templateMetadata) || (templateQueryId && templateMetadata?.id !== templateQueryId)) {
      // Load user template
      loadTemplate(templateQueryId as string);
    } else if (!templateQueryId && templateMetadata) {
      // Navigating back to plain SDL builder - clear storage and reset to defaults
      setTemplateMetadata(null);
      setSdlBuilderSdl(null);
      clearFormStorage();
      setServiceCollapsed([]);
      reset();
    }
  }, [templateQueryId, templateMetadata, clearFormStorage, setSdlBuilderSdl, reset]);

  const { placements: _placements } = watch();

  useEffect(() => {
    if (_services) {
      setSdlBuilderSdl({ placements: _placements as SdlBuilderFormValuesType["placements"], services: _services as ServiceType[], endpoints: [] });
    }
  }, [_services, _placements]);

  const loadTemplate = async (id: string) => {
    try {
      setIsLoadingTemplate(true);
      const response = await consoleApiHttpClient.get(`/v1/user/template/${id}`);
      const template: ITemplate = response.data;

      const imported = importSimpleSdl(template.sdl, { placementPerService: true });

      setIsLoadingTemplate(false);

      reset();
      setValue("placements", imported.placements);
      setValue("services", imported.services);
      setServiceCollapsed(imported.services.map((x, i) => i));
      setTemplateMetadata(template);
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Error fetching template." iconVariant="error" />, {
        variant: "error"
      });

      setIsLoadingTemplate(false);
    }
  };

  const onSubmit = async (data: SdlBuilderFormValuesType) => {
    setError(null);

    try {
      const sdl = generateSdl(data);

      setDeploySdl({
        title: "",
        category: "",
        code: USER_TEMPLATE_CODE,
        description: "",
        content: sdl
      });

      router.push(UrlService.newDeployment({ step: RouteStep.editDeployment }));

      analyticsService.track("deploy_sdl", {
        category: "sdl_builder",
        label: "Deploy SDL from create page"
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const onSaveClick = async () => {
    const result = await trigger();

    if (result) {
      setIsSavingTemplate(true);
    }
  };

  const onPreviewSdlClick = () => {
    setError(null);

    try {
      const sdl = generateSdl(form.getValues());
      setSdlResult(sdl);
      setIsPreviewingSdl(true);

      analyticsService.track("preview_sdl", {
        category: "sdl_builder",
        label: "Preview SDL from create page"
      });
    } catch (error: any) {
      setError(error.message);
    }
  };

  const getTemplateData = () => {
    const sdl = generateSdl(form.getValues());
    const template: Partial<ITemplate> = {
      id: templateMetadata?.id || undefined,
      sdl,
      cpu: _services?.map(s => (s.profile?.cpu || 0) * 1000).reduce((a, b) => a + b, 0),
      ram: _services
        ?.map(s => {
          const ramUnit = memoryUnits.find(x => x.suffix === s.profile?.ramUnit);

          return (s.profile?.ram || 0) * (ramUnit?.value || 0);
        })
        .reduce((a, b) => a + b, 0),
      storage: _services
        ?.map(s => {
          return s.profile?.storage.reduce((memo, storage) => {
            const storageUnit = storageUnits.find(x => x.suffix === storage.unit);
            return memo + (storage.size || 0) * (storageUnit?.value || 0);
          }, 0);
        })
        .reduce((a, b) => a + b, 0)
    };
    return template;
  };

  return (
    <>
      {isImportingSdl && <ImportSdlModal onClose={() => setIsImportingSdl(false)} setValue={setValue} />}
      {isPreviewingSdl && <PreviewSdl onClose={() => setIsPreviewingSdl(false)} sdl={sdlResult || ""} />}
      {isSavingTemplate && (
        <SaveTemplateModal
          onClose={() => setIsSavingTemplate(false)}
          getTemplateData={getTemplateData}
          templateMetadata={templateMetadata as ITemplate}
          setTemplateMetadata={setTemplateMetadata}
          services={_services as ServiceType[]}
          clearFormStorage={clearFormStorage}
        />
      )}

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          {templateMetadata && (
            <div className="flex items-center">
              <p>
                {templateMetadata.title}&nbsp;by&nbsp;
                {templateMetadata.username && (
                  <span
                    onClick={() => {
                      analyticsService.track("click_sdl_profile", {
                        category: "sdl_builder",
                        label: "Click on SDL user profile"
                      });
                    }}
                  >
                    <Link href={UrlService.userProfile(templateMetadata.username)}>{templateMetadata.username}</Link>
                  </span>
                )}
              </p>

              <div className="ml-6">
                <Link
                  href={UrlService.template(templateQueryId as string)}
                  className="inline-flex cursor-pointer items-center"
                  onClick={() => {
                    analyticsService.track("click_view_template", {
                      category: "sdl_builder",
                      label: "Click on view SDL template"
                    });
                  }}
                >
                  View template <NavArrowRight className="ml-2 text-sm" />
                </Link>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-6">
            <div className="flex items-center space-x-6">
              <Button color="secondary" variant="default" type="submit" size="sm">
                Deploy
              </Button>

              <Button color="secondary" variant="text" onClick={onPreviewSdlClick} type="button" size="sm">
                Preview
              </Button>

              <Button color="secondary" variant="text" onClick={() => setIsImportingSdl(true)} type="button" size="sm">
                Import
              </Button>

              <Button
                variant="text"
                size="sm"
                type="button"
                onClick={() => {
                  analyticsService.track("reset_sdl", {
                    category: "sdl_builder",
                    label: "Reset SDL"
                  });

                  setValue("placements", initialValues.placements);
                  setValue("services", initialValues.services);
                }}
              >
                Reset
              </Button>

              {isLoadingTemplate && (
                <div>
                  <Spinner size="small" />
                </div>
              )}
            </div>

            <div>
              <Button color="secondary" variant="default" type="button" onClick={() => onSaveClick()} size="sm">
                Save
              </Button>
            </div>
          </div>

          {_services?.map((service, serviceIndex) => (
            <SimpleServiceFormControl
              key={service.id}
              serviceIndex={serviceIndex}
              _services={_services as ServiceType[]}
              setValue={setValue}
              control={control}
              trigger={trigger}
              onRemoveService={serviceManager.remove}
              serviceCollapsed={serviceCollapsed}
              setServiceCollapsed={setServiceCollapsed}
              gpuModels={gpuModels}
            />
          ))}

          {error && (
            <Alert variant="destructive" className="mt-6">
              {error}
            </Alert>
          )}

          <div className="flex items-center justify-end pt-6">
            <div>
              <Button color="secondary" variant="default" onClick={serviceManager.add} type="button" size="sm">
                Add Service
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
};
