import { Dispatch, useState } from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { Bitbucket, Lock } from "iconoir-react";
import { useAtom } from "jotai";
import { nanoid } from "nanoid";

import remoteDeployStore from "@src/store/remoteDeployStore";
const Repos = ({
  repos,
  setValue,
  isLoading,
  setDeploymentName,
  profile
}: {
  repos: any;
  setValue: any;
  isLoading: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  profile: any;
}) => {
  const [open, setOpen] = useState(false);
  console.log(repos);

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
          // const currentRepo = repos?.values?.find(repo => repo?.links?.html?.href === value);
          setValue("services.0.env", [
            { id: nanoid(), key: "REPO_URL", value: value, isSecret: false },
            { id: nanoid(), key: "BRANCH_NAME", value: repos?.values?.find(repo => repo?.links?.html?.href === value)?.mainbranch?.name, isSecret: false },
            { id: nanoid(), key: "BITBUCKET_ACCESS_TOKEN", value: token?.access_token, isSecret: false },
            { id: nanoid(), key: "BITBUCKET_USER", value: profile?.username, isSecret: false }
          ]);
          setDeploymentName(repos?.values?.find(repo => repo?.links?.html?.href === value)?.name);
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
            {repos?.values?.map((repo: any) => (
              <SelectItem key={repo?.full_name} value={repo?.links?.html?.href}>
                <div className="flex items-center">
                  <Bitbucket className="mr-2" />
                  {repo?.name}

                  {repo?.is_private && <Lock className="ml-1 text-xs" />}
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
