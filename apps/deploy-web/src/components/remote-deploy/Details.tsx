import { useState } from "react";
import { Card, CardContent, Checkbox, Collapsible, CollapsibleContent, CollapsibleTrigger, Label, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

import CustomInput from "./CustomInput";
import { appendEnv } from "./utils";

const Details = ({ services, setValue }) => {
  const [expanded, setExpanded] = useState(false);
  const currentService = services[0];
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
              <div className="flex flex-col gap-3 rounded border bg-card px-6 py-6 text-card-foreground">
                <div className="flex items-center justify-between gap-5">
                  <Label htmlFor="disable-pull" className="text-base">
                    Auto Deploy
                  </Label>

                  <Checkbox
                    checked={currentService?.env?.find(env => env.key === "DISABLE_PULL")?.value !== "yes"}
                    id="disable-pull"
                    defaultChecked={false}
                    onCheckedChange={value => {
                      const pull = !value ? "yes" : "no";
                      appendEnv("DISABLE_PULL", pull, false, setValue, services);
                    }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  By default, console automatically detects and deploys changes, disable it to handle deploys manually
                </p>
              </div>
              <CustomInput
                onChange={e => appendEnv("INSTALL_COMMAND", e.target.value, false, setValue, services)}
                label="Install Command"
                placeholder="npm install"
              />
              <CustomInput onChange={e => appendEnv("BUILD_DIRECTORY", e.target.value, false, setValue, services)} label="Build Directory" placeholder="dist" />
              <CustomInput
                onChange={e => appendEnv("BUILD_COMMAND", e.target.value, false, setValue, services)}
                label="Build Command"
                placeholder="npm run build"
              />
              <CustomInput onChange={e => appendEnv("CUSTOM_SRC", e.target.value, false, setValue, services)} label="Start Command" placeholder="npm start" />
              <CustomInput onChange={e => appendEnv("NODE_VERSION", e.target.value, false, setValue, services)} label="Node Version" placeholder="21" />
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
export default Details;
