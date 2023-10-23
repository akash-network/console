import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { useForm, useFieldArray } from "react-hook-form";
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
import { PreviewSdl } from "./PreviewSdl";

type Props = {};

export const RentGpusForm: React.FunctionComponent<Props> = ({}) => {
  const [error, setError] = useState(null);
  const [templateMetadata, setTemplateMetadata] = useState<ITemplate>(null);
  const formRef = useRef<HTMLFormElement>();
  const [, setDeploySdl] = useAtom(sdlStore.deploySdl);
  // const [sdlBuilderSdl, setSdlBuilderSdl] = useAtom(sdlStore.sdlBuilderSdl);
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
  const { services: _services } = watch();
  const router = useRouter();

  // useEffect(() => {
  //   if (sdlBuilderSdl && sdlBuilderSdl.services) {
  //     setValue("services", sdlBuilderSdl.services);
  //   }
  // }, []);

  // useEffect(() => {
  //   if (_services) {
  //     setSdlBuilderSdl({ services: _services });
  //   }
  // }, [_services]);

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
      setError(error.message);
    }
  };

  return (
    <>

      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">

        <Box sx={{ paddingTop: "1rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Button color="secondary" variant="contained" type="submit">
              Deploy
            </Button>
          </Box>
        </Box>

        

        {error && (
          <Alert severity="error" variant="outlined" sx={{ marginTop: "1rem" }}>
            {error}
          </Alert>
        )}
      </form>
    </>
  );
};
