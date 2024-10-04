import React, { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Checkbox, Label, Snackbar } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";

import { EnvFormModal } from "@src/components/sdl/EnvFormModal";
import { EnvVarList } from "@src/components/sdl/EnvVarList";
import { CI_CD_TEMPLATE_ID, CURRENT_SERVICE, protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { SdlBuilderProvider } from "@src/context/SdlBuilderProvider";
import { useTemplates } from "@src/context/TemplatesProvider";
import { EnvVarUpdater } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { tokens } from "@src/store/remoteDeployStore";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import BitBranches from "../bitbucket/BitBucketBranches";
import GithubBranches from "../github/GithubBranches";
import GitBranches from "../gitlab/GitlabBranches";
import Rollback from "./Rollback";

const RemoteDeployUpdate = ({ sdlString, onManifestChange }: { sdlString: string; onManifestChange: (value: string) => void }) => {
  const [token] = useAtom(tokens);

  const { enqueueSnackbar } = useSnackbar();

  const [isEditingEnv, setIsEditingEnv] = useState<number | boolean | null>(false);
  const { control, watch, setValue } = useForm<SdlBuilderFormValuesType>({ defaultValues: { services: [defaultService] } });
  const { fields: services } = useFieldArray({ control, name: "services", keyName: "id" });
  const envVarUpdater = new EnvVarUpdater(services);
  const { getTemplateById } = useTemplates();
  const remoteDeployTemplate = getTemplateById(CI_CD_TEMPLATE_ID);
  useEffect(() => {
    const { unsubscribe }: any = watch(data => {
      const sdl = generateSdl(data.services as ServiceType[]);
      onManifestChange(sdl);
    });
    try {
      if (sdlString) {
        const services = createAndValidateSdl(sdlString);
        setValue("services", services as ServiceType[]);
      }
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Error while parsing SDL file" />, { variant: "error" });
    }

    return () => {
      unsubscribe();
    };
  }, [watch, sdlString]);

  const createAndValidateSdl = (yamlStr: string) => {
    try {
      if (!yamlStr) return [];
      const services = importSimpleSdl(yamlStr);

      return services;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        enqueueSnackbar(<Snackbar title={err.message} />, { variant: "error" });
      } else if (err.name === "TemplateValidation") {
        enqueueSnackbar(<Snackbar title={err.message} />, { variant: "error" });
      } else {
        enqueueSnackbar(<Snackbar title="Error while parsing SDL file" />, { variant: "error" });
      }
    }
  };
  return remoteDeployTemplate?.deploy?.includes(services?.[0]?.image) && services?.[0]?.env && services?.[0]?.env?.length > 0 ? (
    <div className="flex flex-col gap-6 rounded border bg-card px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
        <div className="flex items-center justify-between gap-5">
          <Label htmlFor="disable-pull" className="text-base">
            Auto Deploy
          </Label>

          <Checkbox
            id="disable-pull"
            checked={services[0]?.env?.find(e => e.key === protectedEnvironmentVariables.DISABLE_PULL)?.value !== "yes"}
            onCheckedChange={value => {
              const pull = !value ? "yes" : "no";

              setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.DISABLE_PULL, pull, false));
              enqueueSnackbar(<Snackbar title={"Info"} subTitle="You need to click update deployment button to apply changes" iconVariant="info" />, {
                variant: "info"
              });
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">If checked, Console will automatically re-deploy your app on any code commits</p>
      </div>
      <SdlBuilderProvider>
        <EnvVarList currentService={services[0]} setIsEditingEnv={setIsEditingEnv} isRemoteDeployEnvHidden />
      </SdlBuilderProvider>
      {isEditingEnv && (
        <EnvFormModal
          isUpdate
          isRemoteDeployEnvHidden
          control={control}
          serviceIndex={0}
          envs={services[0]?.env ?? []}
          onClose={() => {
            setIsEditingEnv(false);
          }}
        />
      )}

      {token.accessToken && services[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value?.includes(token.type) && (
        <>
          <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold">Rollback</h1> <p className="text-muted-foreground">Rollback to a specific commit</p>
            </div>

            <Rollback control={control} services={services} />
          </div>
          {token?.type === "github" ? (
            <GithubBranches services={services} control={control} />
          ) : token?.type === "gitlab" ? (
            <GitBranches control={control} services={services} />
          ) : (
            <BitBranches control={control} services={services} />
          )}
        </>
      )}
    </div>
  ) : null;
};
export default RemoteDeployUpdate;
