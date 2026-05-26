"use client";
import type { Dispatch } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Alert, Button, Form, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";

import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useSdlServiceManager } from "@src/hooks/useSdlServiceManager/useSdlServiceManager";
import { useGpuModels } from "@src/queries/useGpuQuery";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { getDefaultService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { transformCustomSdlFields, TransformError } from "@src/utils/sdl/transformCustomSdlFields";
import RemoteRepositoryDeployManager from "../remote-deploy/RemoteRepositoryDeployManager";
import { SimpleServiceFormControl } from "../sdl/SimpleServiceFormControl";

export const DEPENDENCIES = {
  SimpleServiceFormControl,
  RemoteRepositoryDeployManager,
  useSdlBuilder,
  useWallet,
  useSdlServiceManager,
  useGpuModels
};

export interface Props {
  sdlString: string | null;
  setEditedManifest: Dispatch<string>;
  isGitProviderTemplate?: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  setIsRepoInputValid?: Dispatch<boolean>;
  onValidate?: (event: { isValid: boolean }) => void;
  dependencies?: typeof DEPENDENCIES;
}

export type SdlBuilderRefType = {
  getSdl: () => string | undefined;
  validate: () => Promise<boolean>;
};

export const SdlBuilder = React.forwardRef<SdlBuilderRefType, Props>(
  (
    { sdlString, setEditedManifest, isGitProviderTemplate, setDeploymentName, deploymentName, setIsRepoInputValid, onValidate, dependencies: d = DEPENDENCIES },
    ref
  ) => {
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [isInit, setIsInit] = useState(false);
    const { hasComponent, imageList } = d.useSdlBuilder();
    const form = useForm<SdlBuilderFormValuesType>({
      defaultValues: {
        services: [getDefaultService({ supportsSSH: hasComponent("ssh") })],
        imageList: imageList,
        hasSSHKey: hasComponent("ssh")
      },
      resolver: zodResolver(SdlBuilderFormValuesSchema)
    });
    const { control, trigger, watch, setValue, formState } = form;
    const serviceManager = d.useSdlServiceManager({ control });

    const { services: formServices = [] } = watch();
    const { data: gpuModels } = d.useGpuModels();
    const [serviceCollapsed, setServiceCollapsed] = useState(isGitProviderTemplate ? [0] : []);

    const wallet = d.useWallet();

    useEffect(() => {
      if (wallet.isManaged) {
        formServices.forEach((service, index) => {
          const { denom } = service.placement.pricing;

          if (denom !== wallet.denom) {
            setValue(`services.${index}.placement.pricing.denom`, wallet.denom);
          }
        });
      }
    }, [formServices, sdlString, wallet.isManaged, wallet.denom]);

    React.useImperativeHandle(ref, () => ({
      getSdl: getSdl,
      validate: async () => {
        return await trigger();
      }
    }));

    const lastSyncedSdlRef = useRef<string | null>(null);

    useEffect(() => {
      const { unsubscribe } = watch(data => {
        const sdl = generateSdl(data.services as ServiceType[]);
        lastSyncedSdlRef.current = sdl;
        setEditedManifest(sdl);
      });
      return () => {
        unsubscribe();
      };
    }, [watch, setEditedManifest]);

    useEffect(() => {
      if (sdlString && sdlString !== lastSyncedSdlRef.current) {
        try {
          const services = createAndValidateSdl(sdlString);
          if (services) {
            lastSyncedSdlRef.current = sdlString;
            setValue("services", services as ServiceType[]);
          }
        } catch (error) {
          setError("Error importing SDL");
        }
      }
      setIsInit(true);
    }, [sdlString, setValue]);

    useEffect(() => {
      onValidate?.({ isValid: formState.isValid });
    }, [formState.isValid]);

    const getSdl = () => {
      try {
        return generateSdl(transformCustomSdlFields(formServices, { withSSH: hasComponent("ssh") }));
      } catch (err) {
        if (err instanceof TransformError) {
          setError(err.message);
        }
      }
    };

    const createAndValidateSdl = (yamlStr: string) => {
      try {
        if (!yamlStr) return [];

        const services = importSimpleSdl(yamlStr);

        setError(null);

        return services;
      } catch (err: any) {
        if (err.name === "YAMLException" || err.name === "CustomValidationError") {
          setError(err.message);
        } else if (err.name === "TemplateValidation") {
          setError(err.message);
        } else {
          setError("Error while parsing SDL file");
        }
      }
    };

    return (
      <div className="pb-8">
        {!isInit ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size="large" />
          </div>
        ) : (
          <>
            {isGitProviderTemplate && (
              <d.RemoteRepositoryDeployManager
                setValue={setValue}
                services={formServices as ServiceType[]}
                control={control}
                setDeploymentName={setDeploymentName}
                deploymentName={deploymentName}
                setIsRepoInputValid={setIsRepoInputValid}
              />
            )}
            <Form {...form}>
              <form ref={formRef} autoComplete="off">
                {formServices &&
                  formServices.map((service, serviceIndex) => (
                    <d.SimpleServiceFormControl
                      key={service.id}
                      serviceIndex={serviceIndex}
                      gpuModels={gpuModels}
                      setValue={setValue}
                      _services={formServices as ServiceType[]}
                      control={control}
                      trigger={trigger}
                      onRemoveService={serviceManager.remove}
                      serviceCollapsed={serviceCollapsed}
                      setServiceCollapsed={setServiceCollapsed}
                      hasSecretOption={false}
                      isGitProviderTemplate={isGitProviderTemplate}
                    />
                  ))}

                {error && (
                  <Alert variant="destructive" className="mt-4">
                    {error}
                  </Alert>
                )}

                {!hasComponent("ssh") && !isGitProviderTemplate && (
                  <div className="flex items-center justify-end pt-4">
                    <div>
                      <Button variant="default" size="sm" type="button" onClick={serviceManager.add}>
                        Add Service
                      </Button>
                    </div>
                  </div>
                )}
              </form>
            </Form>
          </>
        )}
      </div>
    );
  }
);
