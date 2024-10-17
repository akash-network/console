import { useMemo, useState } from "react";
import { UseFormSetValue } from "react-hook-form";
import { Card, CardContent, Checkbox, Collapsible, CollapsibleContent, CollapsibleTrigger, Label, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

import { CURRENT_SERVICE, protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { EnvVarUpdater } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import BoxTextInput from "../BoxTextInput";

const RemoteBuildInstallConfig = ({ services, setValue }: { services: ServiceType[]; setValue: UseFormSetValue<SdlBuilderFormValuesType> }) => {
  const [expanded, setExpanded] = useState(false);
  const currentService = services[0];
  const envVarUpdater = useMemo(() => new EnvVarUpdater(services), [services]);
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
              <h1 className="font-semibold">Build & Install Configurations</h1>
              <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
            </div>
          </CollapsibleTrigger>
          {expanded && <Separator />}
          <CollapsibleContent>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <BoxTextInput
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.INSTALL_COMMAND, e.target.value, false))
                }
                label="Install Command"
                placeholder="npm install"
              />
              <BoxTextInput
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.BUILD_DIRECTORY, e.target.value, false))
                }
                label="Build Directory"
                placeholder="dist"
              />
              <BoxTextInput
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.BUILD_COMMAND, e.target.value, false))
                }
                label="Build Command"
                placeholder="npm run build"
              />
              <BoxTextInput
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.CUSTOM_SRC, e.target.value, false))
                }
                label="Start Command"
                placeholder="npm start"
              />
              <BoxTextInput
                onChange={e =>
                  setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.NODE_VERSION, e.target.value, false))
                }
                label="Node Version"
                placeholder="21"
              />
              <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
                <div className="flex items-center justify-between gap-5">
                  <Label htmlFor="disable-pull" className="text-base">
                    Auto Deploy
                  </Label>

                  <Checkbox
                    checked={currentService?.env?.find(env => env.key === protectedEnvironmentVariables.DISABLE_PULL)?.value !== "yes"}
                    id="disable-pull"
                    defaultChecked={false}
                    onCheckedChange={value => {
                      const pull = !value ? "yes" : "no";
                      setValue(CURRENT_SERVICE, envVarUpdater.addOrUpdateEnvironmentVariable(protectedEnvironmentVariables.DISABLE_PULL, pull, false));
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">If checked, Console will automatically re-deploy your app on any code commits</p>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
export default RemoteBuildInstallConfig;
