import { Dispatch, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectSeparator, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { GithubCircle, Lock, Plus } from "iconoir-react";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { ServiceType } from "@src/types";
import { handleLogin } from "../api/api";
const Repos = ({
  repos,
  setValue,
  isLoading,
  services,
  setDeploymentName,
  profile
}: {
  repos: any;
  setValue: any;
  services: ServiceType[];
  isLoading: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  profile: any;
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
        value={services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value}
        open={open}
        onValueChange={value => {
          if (value === "add") {
            handleLogin();
            return;
          }
          const curRepo = repos?.find(repo => repo.html_url === value);
          const access_token = { id: nanoid(), key: "GITHUB_ACCESS_TOKEN", value: token?.access_token, isSecret: false };
          const repo_url = { id: nanoid(), key: "REPO_URL", value: value, isSecret: false };
          const branch_name = { id: nanoid(), key: "BRANCH_NAME", value: curRepo?.default_branch, isSecret: false };
          setValue("services.0.env", curRepo?.private ? [repo_url, branch_name, access_token] : [repo_url, branch_name]);
          setDeploymentName(curRepo?.name);
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
            <SelectItem value="add">
              <div className="flex items-center">
                <Plus className="mr-2" />
                Add More Repositories
              </div>
            </SelectItem>
            <SelectSeparator />

            {repos
              ?.filter((repo: any) => repo.owner?.login === profile?.login)
              ?.map((repo: any) => (
                <SelectItem key={repo.html_url} value={repo.html_url}>
                  <div className="flex items-center">
                    <GithubCircle className="mr-2" />
                    {repo.name}

                    {repo.private && <Lock className="ml-1 text-xs" />}
                  </div>
                </SelectItem>
              ))}
            {/* add more repos */}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Repos;
