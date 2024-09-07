import { Dispatch, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { GitlabFull, Lock } from "iconoir-react";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { ServiceType } from "@src/types";
const Repos = ({
  repos,
  setValue,
  isLoading,
  setDeploymentName,
  services
}: {
  services: ServiceType[];
  isLoading: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  repos: any;
  setValue: any;
}) => {
  const [open, setOpen] = useState(false);

  const [token] = useAtom(remoteDeployStore.tokens);
  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Repository</h1>
        <p className="text-muted-foreground">The Repository Branch used for your private service</p>
      </div>

      <Select
        onOpenChange={value => {
          setOpen(value);
        }}
        open={open}
        onValueChange={value => {
          const currentRepo = repos?.find(repo => repo?.web_url === value);
          setValue("services.0.env", [
            {
              id: nanoid(),
              key: "REPO_URL",
              value: value,
              isSecret: false
            },
            { id: nanoid(), key: "BRANCH_NAME", value: repos?.find(e => e.web_url === value)?.default_branch, isSecret: false },
            { id: nanoid(), key: "GITLAB_ACCESS_TOKEN", value: token?.access_token, isSecret: false },
            {
              id: nanoid(),
              key: "GITLAB_PROJECT_ID",
              value: currentRepo?.id?.toString(),
              isSecret: false
            }
          ]);

          setDeploymentName(repos?.find(e => e.web_url === value)?.name);
        }}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {isLoading && <Spinner size="small" />}
            <SelectValue placeholder={"Select Repository"} />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {/* //only show public repos */}
            {repos?.map((repo: any) => (
              <SelectItem key={repo?.name} value={repo?.web_url}>
                <div className="flex items-center">
                  <GitlabFull className="mr-2" />
                  {repo?.name}

                  {repo?.visibility === "private" && <Lock className="ml-1 text-xs" />}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Repos;
