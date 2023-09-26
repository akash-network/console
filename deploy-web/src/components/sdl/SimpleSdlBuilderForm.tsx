import { useTheme } from "@mui/material/styles";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useForm, useFieldArray } from "react-hook-form";
import { makeStyles } from "tss-react/mui";
import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { ITemplate, SdlBuilderFormValues, Service } from "@src/types";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { defaultService } from "@src/utils/sdl/data";
import { SimpleServiceFormControl } from "./SimpleServiceFormControl";
import { ImportSdlModal } from "./ImportSdlModal";
import { useRouter } from "next/router";
import axios from "axios";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { SaveTemplateModal } from "./SaveTemplateModal";
import { useSnackbar } from "notistack";
import { Snackbar } from "../shared/Snackbar";
import { event } from "nextjs-google-analytics";
import { AnalyticsEvents } from "@src/utils/analytics";
import { memoryUnits, storageUnits } from "../shared/akash/units";
import sdlStore from "@src/store/sdlStore";
import { RouteStepKeys } from "@src/utils/constants";
import { useAtom } from "jotai";
import { useProviderAttributesSchema } from "@src/queries/useProvidersQuery";

const useStyles = makeStyles()(theme => ({
  formControl: {
    marginBottom: theme.spacing(1.5)
  },
  textField: {
    width: "100%"
  },
  serviceBox: {
    marginTop: "1rem",
    border: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100]}`,
    borderRadius: ".5rem"
  },
  editLink: {
    color: theme.palette.secondary.light,
    textDecoration: "underline",
    cursor: "pointer",
    fontWeight: "normal",
    fontSize: ".8rem"
  },
  formValue: {
    color: theme.palette.grey[500]
  }
}));

type Props = {};

export const SimpleSDLBuilderForm: React.FunctionComponent<Props> = ({}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const [error, setError] = useState(null);
  const [templateMetadata, setTemplateMetadata] = useState<ITemplate>(null);
  const [serviceCollapsed, setServiceCollapsed] = useState([]);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isImportingSdl, setIsImportingSdl] = useState(false);
  const [, setSdlResult] = useState<string>(null);
  const formRef = useRef<HTMLFormElement>();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  const { data: providerAttributesSchema } = useProviderAttributesSchema();
  const { enqueueSnackbar } = useSnackbar();
  const {
    handleSubmit,
    reset,
    control,
    formState: { isValid },
    trigger,
    watch,
    setValue
  } = useForm<SdlBuilderFormValues>({
    defaultValues: {
      services: [{ ...defaultService }]
    }
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

  // Load the template from query string on mount
  useEffect(() => {
    if ((router.query.id && !templateMetadata) || (router.query.id && templateMetadata?.id !== router.query.id)) {
      loadTemplate(router.query.id as string);
    } else if (!router.query.id && templateMetadata) {
      setTemplateMetadata(null);
      reset();
    }
  }, [router.query.id, templateMetadata]);

  const loadTemplate = async (id: string) => {
    try {
      setIsLoadingTemplate(true);
      const response = await axios.get(`/api/proxy/user/template/${id}`);
      const template: ITemplate = response.data;

      const services = importSimpleSdl(template.sdl, providerAttributesSchema);

      setIsLoadingTemplate(false);

      reset();
      setValue("services", services as Service[]);
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

  const onSubmit = async (data: SdlBuilderFormValues) => {
    setError(null);

    try {
      const sdl = generateSdl(data);

      setSdlResult(sdl);

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

  const getTemplateData = () => {
    const sdl = generateSdl({ services: _services });
    const template: Partial<ITemplate> = {
      id: templateMetadata?.id || null,
      sdl,
      cpu: _services.map(s => s.profile.cpu * 1000).reduce((a, b) => a + b, 0),
      ram: _services
        .map(s => {
          const ramUnit = memoryUnits.find(x => x.suffix === s.profile.ramUnit);

          return s.profile.ram * ramUnit.value;
        })
        .reduce((a, b) => a + b, 0),
      storage: _services
        .map(s => {
          const ephemeralStorageUnit = storageUnits.find(x => x.suffix === s.profile.ramUnit);
          const peristentStorageUnit = storageUnits.find(x => x.suffix === s.profile.persistentStorageUnit);
          const ephemeralStorage = s.profile.storage + ephemeralStorageUnit.value;
          const persistentStorage = s.profile.hasPersistentStorage ? s.profile.persistentStorage + peristentStorageUnit.value : 0;

          return ephemeralStorage + persistentStorage;
        })
        .reduce((a, b) => a + b, 0)
    };
    return template;
  };

  return (
    <>
      {isImportingSdl && <ImportSdlModal onClose={() => setIsImportingSdl(false)} setValue={setValue} />}
      {isSavingTemplate && (
        <SaveTemplateModal
          onClose={() => setIsSavingTemplate(false)}
          getTemplateData={getTemplateData}
          templateMetadata={templateMetadata}
          setTemplateMetadata={setTemplateMetadata}
          services={_services}
        />
      )}

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        {templateMetadata && (
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Typography variant="body1">
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
            </Typography>

            <Box sx={{ marginLeft: "1.5rem" }}>
              <Box
                href={UrlService.template(router.query.id as string)}
                component={Link}
                sx={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}
                onClick={() => {
                  event(AnalyticsEvents.CLICK_VIEW_TEMPLATE, {
                    category: "sdl_builder",
                    label: "Click on view SDL template"
                  });
                }}
              >
                View template <ArrowForwardIcon sx={{ marginLeft: ".5rem" }} fontSize="small" />
              </Box>
            </Box>
          </Box>
        )}

        <Box sx={{ paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button color="secondary" variant="contained" type="submit">
              Deploy
            </Button>

            <Button color="secondary" variant="text" onClick={() => setIsImportingSdl(true)} sx={{ marginLeft: "1rem" }}>
              Import
            </Button>

            <Button
              variant="text"
              sx={{ marginLeft: "1rem" }}
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
              <Box sx={{ marginLeft: "1rem" }}>
                <CircularProgress color="secondary" size="1.2rem" />
              </Box>
            )}
          </Box>

          <div>
            <Button color="secondary" variant="contained" onClick={() => onSaveClick()}>
              Save
            </Button>
          </div>
        </Box>

        {services.map((service, serviceIndex) => (
          <SimpleServiceFormControl
            key={service.id}
            service={service}
            serviceIndex={serviceIndex}
            _services={_services}
            providerAttributesSchema={providerAttributesSchema}
            control={control}
            trigger={trigger}
            onRemoveService={onRemoveService}
            serviceCollapsed={serviceCollapsed}
            setServiceCollapsed={setServiceCollapsed}
          />
        ))}

        {error && (
          <Alert severity="error" variant="outlined" sx={{ marginTop: "1rem" }}>
            {error}
          </Alert>
        )}

        <Box sx={{ paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <div>
            <Button color="secondary" variant="contained" onClick={onAddService}>
              Add Service
            </Button>
          </div>
        </Box>
      </form>
    </>
  );
};
