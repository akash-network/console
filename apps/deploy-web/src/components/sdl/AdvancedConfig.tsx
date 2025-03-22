"use client";
import { ReactNode, useEffect, useState } from "react";
import { Control, UseFieldArrayAppend, UseFieldArrayRemove, UseFormSetValue } from "react-hook-form";
import { Button, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import { RentGpusFormValuesType, SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { ExpandMore } from "../shared/ExpandMore";
import { CommandFormModal } from "./CommandFormModal";
import { CommandList } from "./CommandList";
import { EnvFormModal } from "./EnvFormModal";
import { EnvVarList } from "./EnvVarList";
import { ExposeFormModal } from "./ExposeFormModal";
import { ExposeList } from "./ExposeList";
import { MountedStorageFormControl } from "./MountedStorageFormControl";

type Props = {
  currentService: ServiceType;
  control: Control<RentGpusFormValuesType, any>;
  children?: ReactNode;
  storages: any[];
  setValue: UseFormSetValue<RentGpusFormValuesType>;
  appendStorage: UseFieldArrayAppend<SdlBuilderFormValuesType, `services.${number}.profile.storage`>;
  removeStorage: UseFieldArrayRemove;
};

export const AdvancedConfig: React.FunctionComponent<Props> = ({ control, currentService, storages, setValue, appendStorage, removeStorage }) => {
  const [expanded, setIsAdvancedOpen] = useState(false);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [isEditingExpose, setIsEditingExpose] = useState(false);

  useEffect(() => {
    currentService.profile.storage.length > 1 && setIsAdvancedOpen(true);
  }, [currentService.profile.storage]);

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        {/** Edit Environment Variables */}
        {isEditingEnv && (
          <EnvFormModal
            control={control as any}
            onClose={() => setIsEditingEnv(false)}
            serviceIndex={0}
            envs={currentService.env || []}
            hasSecretOption={false}
          />
        )}
        {/** Edit Commands */}
        {isEditingCommands && <CommandFormModal control={control as any} onClose={() => setIsEditingCommands(false)} serviceIndex={0} />}
        {/** Edit Expose */}
        {isEditingExpose && (
          <ExposeFormModal
            control={control as any}
            onClose={() => setIsEditingExpose(false)}
            serviceIndex={0}
            expose={currentService.expose}
            services={[currentService]}
          />
        )}

        <Collapsible open={expanded} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button
              size="lg"
              variant="ghost"
              className={cn("flex w-full items-center justify-between p-4 normal-case", { "border-b border-muted": expanded })}
              type="button"
            >
              <div>
                <p>Advanced Configuration</p>
              </div>

              <ExpandMore expand={expanded} aria-expanded={expanded} aria-label="show more" className="ml-2" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4">
              {currentService.profile.storage.length > 1 &&
                (storages || []).slice(1).map((storage, storageIndex) => (
                  <div key={`storage-${storage.id}`}>
                    <div className="mb-4">
                      <MountedStorageFormControl
                        services={[currentService]}
                        control={control as any}
                        currentService={currentService}
                        serviceIndex={0}
                        storageIndex={storageIndex + 1}
                        appendStorage={appendStorage}
                        removeStorage={removeStorage}
                        setValue={setValue}
                      />
                    </div>
                  </div>
                ))}

              <div className="mb-4">
                <ExposeList currentService={currentService} setIsEditingExpose={() => setIsEditingExpose(true)} />
              </div>
              <div className="mb-4">
                <EnvVarList currentService={currentService} setIsEditingEnv={() => setIsEditingEnv(true)} />
              </div>
              <div className="mb-4">
                <CommandList currentService={currentService} setIsEditingCommands={() => setIsEditingCommands(true)} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
