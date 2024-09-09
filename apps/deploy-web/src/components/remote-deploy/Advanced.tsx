import { useState } from "react";
import { Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

// import { EnvVarList } from "../sdl/EnvVarList";
import { EnvFormModal } from "./EnvFormModal";
import { EnvVarList } from "./EnvList";

const Advanced = ({ services, control }) => {
  const serviceIndex = 0;
  const [expanded, setExpanded] = useState(false);
  const currentService = services[serviceIndex];
  const [isEditingEnv, setIsEditingEnv] = useState<number | boolean | null>(null);
  return (
    <Collapsible
      open={expanded}
      onOpenChange={value => {
        setExpanded(value);
      }}
    >
      <Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <CardContent className="p-0">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4">
              <h1 className="font-semibold">{!expanded && "Environment Variables"}</h1>
              <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
            </div>
          </CollapsibleTrigger>
          {expanded && <Separator />}
          <CollapsibleContent>
            <div className="grid items-start gap-6 p-5">
              {isEditingEnv === serviceIndex && (
                <EnvFormModal
                  control={control}
                  onClose={() => setIsEditingEnv(null)}
                  serviceIndex={serviceIndex}
                  envs={currentService.env || []}
                  // hasSecretOption={hasSecretOption}
                />
              )}
              <div>
                <EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex} />
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};

export default Advanced;
