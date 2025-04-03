import type { Dispatch } from "react";
import { useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { Bitbucket } from "iconoir-react";

import { useWorkspaces } from "../../../queries/useBitBucketQuery";

const WorkSpaces = ({ isLoading, setWorkSpaces }: { isLoading: boolean; workSpaces: string; setWorkSpaces: Dispatch<string> }) => {
  const [open, setOpen] = useState(false);

  const { data, isLoading: loadingWorkSpaces } = useWorkspaces();

  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select WorkSpace</h1>
        <p className="text-muted-foreground">Select a Work-Space to use for deployment</p>
      </div>

      <Select
        onOpenChange={value => {
          setOpen(value);
        }}
        open={open}
        onValueChange={value => {
          setWorkSpaces(value);
        }}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {isLoading || (loadingWorkSpaces && <Spinner size="small" />)}
            <SelectValue placeholder={"Select"} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {data?.values?.map(work => (
              <SelectItem key={work.uuid} value={work.uuid}>
                <div className="flex items-center">
                  <Bitbucket className="mr-2" />
                  {work.name}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default WorkSpaces;
