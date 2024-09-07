import React, { Dispatch, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Checkbox, Label, Snackbar } from "@akashnetwork/ui/components";
import { useAtom } from "jotai";
import { useSnackbar } from "notistack";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { defaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { github } from "@src/utils/templates";
import BitBranches from "../bitbucket/Branches";
import { EnvFormModal } from "../EnvFormModal";
import { EnvVarList } from "../EnvList";
import Branches from "../github/Branches";
import GitBranches from "../gitlab/Branches";
import { appendEnv } from "../utils";
import Rollback from "./Rollback";
const RemoteDeployUpdate = ({ sdlString, setEditedManifest }: { sdlString: string; setEditedManifest: Dispatch<React.SetStateAction<string | null>> }) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  const [, setIsInit] = useState(false);
  const { control, watch, setValue } = useForm<SdlBuilderFormValuesType>({ defaultValues: { services: [defaultService] } });
  const { fields: services } = useFieldArray({ control, name: "services", keyName: "id" });
  useEffect(() => {
    const { unsubscribe }: any = watch(data => {
      const sdl = generateSdl(data.services as ServiceType[]);
      setEditedManifest(sdl);
    });
    try {
      if (sdlString) {
        const services = createAndValidateSdl(sdlString);
        setValue("services", services as ServiceType[]);
      }
    } catch (error) {
      setError("Error importing SDL");
    }
    setIsInit(true);
    return () => {
      unsubscribe();
    };
  }, [watch, sdlString]);
  const { enqueueSnackbar } = useSnackbar();
  const [, setError] = useState<string | null>(null);
  const [isEditingEnv, setIsEditingEnv] = useState<number | boolean | null>(false);
  const createAndValidateSdl = (yamlStr: string) => {
    try {
      if (!yamlStr) return [];
      const services = importSimpleSdl(yamlStr);
      setError(null);
      return services;
    } catch (err) {
      if (err.name === "YAMLException" || err.name === "CustomValidationError") {
        setError(err.message);
      } else if (err.name === "TemplateValidation") {
        setError(err.message);
      } else {
        setError("Error while parsing SDL file");
        console.error(err);
      }
    }
  };
  return github.content.includes(services?.[0]?.image) ? (
    <div className="flex flex-col gap-6 rounded border bg-card px-4 py-6 md:px-6">
      <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
        <div className="flex items-center justify-between gap-5">
          <Label htmlFor="disable-pull" className="text-base">
            Auto Deploy
          </Label>

          <Checkbox
            id="disable-pull"
            checked={services[0]?.env?.find(e => e.key === "DISABLE_PULL")?.value !== "yes"}
            onCheckedChange={value => {
              const pull = !value ? "yes" : "no";
              appendEnv("DISABLE_PULL", pull, false, setValue, services);
              enqueueSnackbar(<Snackbar title={"Info"} subTitle="You need to click update deployment button to apply changes" iconVariant="info" />, {
                variant: "info"
              });
            }}
          />
        </div>
        <p className="text-sm text-muted-foreground">If checked, Console will automatically re-deploy your app on any code commits</p>
      </div>
      {services[0]?.env?.length && (
        <>
          <EnvVarList currentService={services[0]} setIsEditingEnv={setIsEditingEnv} />
          {isEditingEnv && (
            <EnvFormModal
              update
              control={control}
              serviceIndex={0}
              envs={services[0]?.env ?? []}
              onClose={() => {
                setIsEditingEnv(false);
              }}
            />
          )}
        </>
      )}

      {token.access_token && services[0]?.env?.find(e => e.key === "REPO_URL")?.value?.includes(token.type) && (
        <>
          <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
            <div className="flex flex-col gap-2">
              <h1 className="font-semibold">Rollback</h1> <p className="text-muted-foreground">Rollback to a specific commit</p>
            </div>

            <Rollback control={control} services={services} />
          </div>
          {token?.type === "github" ? (
            <Branches services={services} control={control} />
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
