"use client";
import type { Dispatch } from "react";
import React, { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Alert, Button, Form, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import cloneDeep from "lodash/cloneDeep";
import { nanoid } from "nanoid";

import { useSdlBuilder } from "@src/context/SdlBuilderProvider/SdlBuilderProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useManagedWalletDenom } from "@src/hooks/useManagedWalletDenom";
import { useWhen } from "@src/hooks/useWhen";
import { useGpuModels } from "@src/queries/useGpuQuery";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { defaultService, defaultSshVMService } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { transformCustomSdlFields, TransformError } from "@src/utils/sdl/transformCustomSdlFields";
import RemoteRepositoryDeployManager from "../remote-deploy/RemoteRepositoryDeployManager";
import { SimpleServiceFormControl } from "../sdl/SimpleServiceFormControl";

interface Props {
  sdlString: string | null;
  setEditedManifest: Dispatch<string>;
  isGitProviderTemplate?: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  setIsRepoInputValid?: Dispatch<boolean>;
}

export type SdlBuilderRefType = {
  getSdl: () => string | undefined;
  validate: () => Promise<boolean>;
};

export const SdlBuilder = React.forwardRef<SdlBuilderRefType, Props>(
  ({ sdlString, setEditedManifest, isGitProviderTemplate, setDeploymentName, deploymentName, setIsRepoInputValid }, ref) => {
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const [isInit, setIsInit] = useState(false);
    const { hasComponent, imageList } = useSdlBuilder();
    const form = useForm<SdlBuilderFormValuesType>({
      defaultValues: {
        services: [cloneDeep(hasComponent("ssh") ? defaultSshVMService : defaultService)],
        imageList: imageList,
        hasSSHKey: hasComponent("ssh")
      },
      resolver: zodResolver(SdlBuilderFormValuesSchema)
    });
    const { control, trigger, watch, setValue } = form;
    const {
      fields: services,
      remove: removeService,
      append: appendService
    } = useFieldArray({
      control,
      name: "services",
      keyName: "id"
    });
    const { services: formServices = [] } = watch();
    const { data: gpuModels } = useGpuModels();
    const [serviceCollapsed, setServiceCollapsed] = useState(isGitProviderTemplate ? [0] : []);

    const wallet = useWallet();
    const managedDenom = useManagedWalletDenom();

    useWhen(
      wallet.isManaged,
      () => {
        formServices.forEach((service, index) => {
          const { denom } = service.placement.pricing;

          if (denom !== managedDenom) {
            setValue(`services.${index}.placement.pricing.denom`, managedDenom);
          }
        });
      },
      [formServices, sdlString]
    );

    React.useImperativeHandle(ref, () => ({
      getSdl: getSdl,
      validate: async () => {
        return await trigger();
      }
    }));

    useEffect(() => {
      const { unsubscribe } = watch(data => {
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
    }, [watch]);

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

    const onAddService = () => {
      appendService({ ...defaultService, id: nanoid(), title: `service-${services.length + 1}` });
    };

    const onRemoveService = (index: number) => {
      removeService(index);
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
              <RemoteRepositoryDeployManager
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
                  services.map((service, serviceIndex) => (
                    <SimpleServiceFormControl
                      key={service.id}
                      serviceIndex={serviceIndex}
                      gpuModels={gpuModels}
                      setValue={setValue}
                      _services={formServices as ServiceType[]}
                      control={control}
                      trigger={trigger}
                      onRemoveService={onRemoveService}
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
                      <Button variant="default" size="sm" type="button" onClick={onAddService}>
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
