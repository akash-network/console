import React, { useEffect, useRef, useState } from "react";
import { defaultService } from "@src/utils/sdl/data";
import { useFieldArray, useForm } from "react-hook-form";
import { SdlBuilderFormValues, Service } from "@src/types";
import { nanoid } from "nanoid";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { Alert, Box, Button } from "@mui/material";
import { SimpleServiceFormControl } from "../sdl/SimpleServiceFormControl";
import { useProviderAttributesSchema } from "@src/queries/useProvidersQuery";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";

interface Props {
  sdlString: string;
}

export const SdlBuilder: React.FC<Props> = ({ sdlString }) => {
  const [error, setError] = useState(null);
  const formRef = useRef<HTMLFormElement>();
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
  const { data: providerAttributesSchema } = useProviderAttributesSchema();
  const [serviceCollapsed, setServiceCollapsed] = useState([]);

  useEffect(() => {
    if (sdlString) {
      try {
        const services = createAndValidateSdl(sdlString);
        setValue("services", services as Service[]);
      } catch (error) {
        setError("Error importing SDL");
      }
    }
  }, []);

  const createAndValidateSdl = (yamlStr: string) => {
    try {
      if (!yamlStr) return null;

      const services = importSimpleSdl(yamlStr, providerAttributesSchema);

      setError(null);

      return services;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        setError(err.message);
      } else if (err.name === "TemplateValidation") {
        setError(err.message);
      } else {
        setError("Error while parsing SDL file");
        // setParsingError(err.message);
        console.error(err);
      }
    }
  };

  const onSubmit = async (data: SdlBuilderFormValues) => {
    setError(null);

    try {
      const sdl = generateSdl(data);

      // setDeploySdl({
      //   title: "",
      //   category: "",
      //   code: "",
      //   description: "",
      //   content: sdl
      // });

      // router.push(UrlService.newDeployment({ step: RouteStepKeys.editDeployment }));

      // event(AnalyticsEvents.DEPLOY_SDL, {
      //   category: "sdl_builder",
      //   label: "Deploy SDL from create page"
      // });
    } catch (error) {
      // setError(error.message);
    }
  };

  const onAddService = () => {
    appendService({ ...defaultService, id: nanoid(), title: `service-${services.length + 1}` });
  };

  const onRemoveService = (index: number) => {
    removeService(index);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
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
  );
};
