import { useState } from "react";
import { Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, Separator } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

import CustomInput from "./CustomInput";
import { appendEnv } from "./utils";

const Details = ({ services, setValue }) => {
  const [expanded, setExpanded] = useState(false);

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
              <h1 className="font-semibold">Advanced Configurations</h1>
              <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
            </div>
          </CollapsibleTrigger>
          {expanded && <Separator />}
          <CollapsibleContent>
            <div className="grid gap-6 p-5 md:grid-cols-2">
              <CustomInput
                onChange={e => appendEnv("INSTALL_COMMAND", e.target.value, false, setValue, services)}
                label="Install Command"
                description="By default we use npm install, Change the version if needed"
                placeholder="eg. npm install"
              />
              <CustomInput
                onChange={e => appendEnv("BUILD_DIRECTORY", e.target.value, false, setValue, services)}
                label="Build Directory"
                description="The custom build directory name for your repo"
                placeholder="eg. dist"
              />
              <CustomInput
                onChange={e => appendEnv("BUILD_COMMAND", e.target.value, false, setValue, services)}
                label="Build Command"
                description="The custom build command for your repo"
                placeholder="eg. npm run build"
              />
              <CustomInput
                onChange={e => appendEnv("CUSTOM_SRC", e.target.value, false, setValue, services)}
                label="Start Command"
                description="The custom start command for your repo"
                placeholder="eg. npm start"
              />
              <CustomInput
                onChange={e => appendEnv("NODE_VERSION", e.target.value, false, setValue, services)}
                label="Node Version"
                description="By default we use 20, Change the version if needed"
                placeholder="eg. 21"
              />

              {/* <CustomInput
                onChange={e => appendEnv("COMMIT_HASH", e.target.value, false, setValue, services)}
                label="Commit Hash"
                description="The Commit Hash used for your private service"
                
                placeholder="eg. anything"
              /> */}
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
export default Details;
