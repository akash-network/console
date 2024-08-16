import { useState } from "react";
import {
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator
} from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { NavArrowDown } from "iconoir-react";

import { EnvFormModal } from "./EnvFormModal";
import { appendEnv } from "./utils";
const Advanced = ({ services, control, setValue }) => {
  const serviceIndex = 0;
  const [expanded, setExpanded] = useState(false);
  const currentService = services[serviceIndex];
  console.log(services);

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
              <h1 className="font-semibold">Other Options</h1>
              <NavArrowDown fontSize="1rem" className={cn("transition-all duration-100", { ["rotate-180"]: expanded })} />
            </div>
          </CollapsibleTrigger>
          {expanded && <Separator />}
          <CollapsibleContent>
            <div className="flex flex-col gap-6 p-5">
              <EnvFormModal
                control={control}
                onClose={() => {}}
                serviceIndex={serviceIndex}
                envs={currentService.env || []}
                // hasSecretOption={hasSecretOption}
              />
              <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
                <div className="flex flex-col gap-2">
                  <h1 className="font-semibold">Auto-Deploy</h1>
                  <p className="text-muted-foreground">
                    By default, your code is automatically deployed whenever you update it. Disable to handle deploys manually.
                  </p>
                </div>
                <Select
                  value={services?.[0]?.env?.find(e => e.key === "DISABLE_PULL")?.value}
                  onValueChange={value => {
                    appendEnv("DISABLE_PULL", value, false, setValue, services);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <SelectValue placeholder={"Select"} />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};

export default Advanced;
