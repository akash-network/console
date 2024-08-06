"use client";
import { ReactNode, useState } from "react";
import { Control } from "react-hook-form";
import { Button, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@akashnetwork/ui/components";

import { RentGpusFormValuesType, ServiceType } from "@src/types";
import { cn } from "@src/utils/styleUtils";
import { ExpandMore } from "../shared/ExpandMore";
import { CommandFormModal } from "./CommandFormModal";
import { CommandList } from "./CommandList";
import { EnvFormModal } from "./EnvFormModal";
import { EnvVarList } from "./EnvVarList";
import { ExposeFormModal } from "./ExposeFormModal";
import { ExposeList } from "./ExposeList";
import { PersistentStorage } from "./PersistentStorage";

type Props = {
  currentService: ServiceType;
  control: Control<RentGpusFormValuesType, any>;
  children?: ReactNode;
};

export const AdvancedConfig: React.FunctionComponent<Props> = ({ control, currentService }) => {
  const [expanded, setIsAdvancedOpen] = useState(false);
  const [isEditingCommands, setIsEditingCommands] = useState(false);
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [isEditingExpose, setIsEditingExpose] = useState(false);

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
              <div className="mb-4">
                <PersistentStorage control={control as any} currentService={currentService} serviceIndex={0} />
              </div>

              <div className="mb-4">
                <ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} />
              </div>
              <div className="mb-4">
                <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} />
              </div>
              <div className="mb-4">
                <CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
