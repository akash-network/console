import type { Dispatch } from "react";
import { useState } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";

import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { BitProfile } from "@src/types/remoteProfile";
import { useBitReposByWorkspace } from "../../../queries/useBitBucketQuery";
import Repos from "../Repos";
import BitBucketBranches from "./BitBucketBranches";
import WorkSpaces from "./Workspaces";

const BitBucketManager = ({
  loading,
  setValue,
  services,
  control,
  setDeploymentName,
  deploymentName,
  profile
}: {
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  loading: boolean;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  control: Control<SdlBuilderFormValuesType>;
  services: ServiceType[];
  profile?: BitProfile;
}) => {
  const [workSpace, setWorkSpace] = useState<string>("");

  const { data: repos, isLoading } = useBitReposByWorkspace(workSpace);

  return (
    <>
      <WorkSpaces isLoading={loading} workSpaces={workSpace} setWorkSpaces={setWorkSpace} />
      <Repos
        isLoading={isLoading}
        repos={
          repos?.values.map(repo => ({
            name: repo.name,
            default_branch: repo?.mainbranch?.name,
            html_url: repo?.links?.html?.href,
            userName: profile?.username,
            private: repo?.is_private
          })) ?? []
        }
        type="bitbucket"
        setValue={setValue}
        setDeploymentName={setDeploymentName}
        deploymentName={deploymentName}
        services={services}
      />
      <BitBucketBranches services={services} control={control} />
    </>
  );
};

export default BitBucketManager;
