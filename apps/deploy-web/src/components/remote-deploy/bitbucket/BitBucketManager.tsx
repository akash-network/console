import { Dispatch, useState } from "react";

import { ServiceType } from "@src/types";
import { BitProfile } from "@src/types/remoteProfile";
import { ServiceControl, ServiceSetValue } from "../helper-functions";
import { useBitReposByWorkspace } from "../remote-deploy-api-queries/bit-bucket-queries";
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
  setValue: ServiceSetValue;
  services: ServiceType[];
  control: ServiceControl;
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
