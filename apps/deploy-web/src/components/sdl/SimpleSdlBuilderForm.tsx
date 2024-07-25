"use client";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Alert, Button, Form, Snackbar, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { NavArrowRight } from "iconoir-react";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { event } from "nextjs-google-analytics";
import { useSnackbar } from "notistack";

import { SimpleServiceFormControl } from "@src/components/sdl/SimpleServiceFormControl";
import useFormPersist from "@src/hooks/useFormPersist";
import { useGpuModels } from "@src/queries/useGpuQuery";
import sdlStore from "@src/store/sdlStore";
import { ITemplate, SdlBuilderFormValuesSchema, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { memoryUnits, storageUnits } from "@src/utils/akash/units";
import { AnalyticsEvents } from "@src/utils/analytics";
import { RouteStepKeys } from "@src/utils/constants";
import { defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { UrlService } from "@src/utils/urlUtils";
import { ImportSdlModal } from "./ImportSdlModal";
import { PreviewSdl } from "./PreviewSdl";
import { SaveTemplateModal } from "./SaveTemplateModal";

const DEFAULT_SERVICES = {
  services: [{ ...defaultService }]
};

export const SimpleSDLBuilderForm: React.FunctionComponent = () => {
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
  const form = useForm<SdlBuilderFormValuesType>({
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const { handleSubmit, reset, control, trigger, watch, setValue } = form;
  useFormPersist("sdl-builder-form", {
    watch,
    setValue,
    defaultValues: DEFAULT_SERVICES,
    storage: typeof window === "undefined" ? undefined : window.localStorage
  });
  const {
    fields: services,
    remove: removeService,
    append: appendService
  } = useFieldArray({
    control,
    name: "services",
    keyName: "id"
  });
  const { services: _services } = watch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateQueryId = searchParams?.get("id");

  useEffect(() => {
    if (sdlBuilderSdl && sdlBuilderSdl.services) {
      setValue("services", sdlBuilderSdl.services);
    }
  }, []);

  // Load the template from query string on mount
  useEffect(() => {
    if ((templateQueryId && !templateMetadata) || (templateQueryId && templateMetadata?.id !== templateQueryId)) {
      // Load user template
      loadTemplate(templateQueryId as string);
    } else if (!templateQueryId && templateMetadata) {
      setTemplateMetadata(null);
      reset();
    }
  }, [templateQueryId, templateMetadata]);

  useEffect(() => {
    if (_services) {
      setSdlBuilderSdl({ services: _services as ServiceType[] });
    }
  }, [_services]);

  const loadTemplate = async (id: string) => {
    try {
      setIsLoadingTemplate(true);
      const response = await axios.get(`/api/proxy/user/template/${id}`);
      const template: ITemplate = response.data;

      const services = importSimpleSdl(template.sdl);

      setIsLoadingTemplate(false);

      reset();
      setValue("services", services as ServiceType[]);
      setServiceCollapsed(services.map((x, i) => i));
      setTemplateMetadata(template);
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Error fetching template." iconVariant="error" />, {
        variant: "error"
      });

      setIsLoadingTemplate(false);
    }
  };

  const onAddService = () => {
    appendService({ ...defaultService, id: nanoid(), title: `service-${services.length + 1}` });
  };

  const onRemoveService = (index: number) => {
    removeService(index);
  };

  const onSubmit = async (data: SdlBuilderFormValuesType) => {
    setError(null);

    try {
      const sdl = generateSdl(data.services);

      setDeploySdl({
        title: "",
        category: "",
        code: "",
        description: "",
        content: sdl
      });

      router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));

      event(AnalyticsEvents.DEPLOY_SDL, {
        category: "sdl_builder",
        label: "Deploy SDL from create page"
      });
    } catch (error) {
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
      const sdl = generateSdl(_services as ServiceType[]);
      setSdlResult(sdl);
      setIsPreviewingSdl(true);

      event(AnalyticsEvents.PREVIEW_SDL, {
        category: "sdl_builder",
        label: "Preview SDL from create page"
      });
    } catch (error) {
      setError(error.message);
    }
  };

  const getTemplateData = () => {
    const sdl = generateSdl(_services as ServiceType[]);
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
          const ephemeralStorageUnit = storageUnits.find(x => x.suffix === s.profile?.ramUnit);
          const peristentStorageUnit = storageUnits.find(x => x.suffix === s.profile?.persistentStorageUnit);
          const ephemeralStorage = (s.profile?.storage || 0) + (ephemeralStorageUnit?.value || 0);
          const persistentStorage = s.profile?.hasPersistentStorage ? (s.profile?.persistentStorage || 0) + (peristentStorageUnit?.value || 0) : 0;

          return ephemeralStorage + persistentStorage;
        })
        .reduce((a, b) => a + b, 0)
    };
    return template;
  };

  console.log(form)

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
                      event(AnalyticsEvents.CLICK_SDL_PROFILE, {
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
                    event(AnalyticsEvents.CLICK_VIEW_TEMPLATE, {
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

          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center">
              <Button color="secondary" variant="default" type="submit">
                Deploy
              </Button>

              <Button color="secondary" variant="text" onClick={onPreviewSdlClick} className="ml-4" type="button">
                Preview
              </Button>

              <Button color="secondary" variant="text" onClick={() => setIsImportingSdl(true)} className="ml-4" type="button">
                Import
              </Button>

              <Button
                variant="text"
                className="ml-4"
                type="button"
                onClick={() => {
                  event(AnalyticsEvents.RESET_SDL, {
                    category: "sdl_builder",
                    label: "Reset SDL"
                  });

                  setValue("services", [{ ...defaultService }]);
                }}
              >
                Reset
              </Button>

              {isLoadingTemplate && (
                <div className="ml-4">
                  <Spinner size="small" />
                </div>
              )}
            </div>

            <div>
              <Button color="secondary" variant="default" type="button" onClick={() => onSaveClick()}>
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
              onRemoveService={onRemoveService}
              serviceCollapsed={serviceCollapsed}
              setServiceCollapsed={setServiceCollapsed}
              gpuModels={gpuModels}
            />
          ))}

          {error && (
            <Alert variant="destructive" className="mt-4">
              {error}
            </Alert>
          )}

          <div className="flex items-center justify-end pt-4">
            <div>
              <Button color="secondary" variant="default" onClick={onAddService} type="button">
                Add Service
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </>
  );
};
