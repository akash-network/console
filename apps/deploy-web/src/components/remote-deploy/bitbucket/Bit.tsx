import { Dispatch, useState } from "react";

import { ServiceType } from "@src/types";
import { BitProfile } from "@src/types/remoteProfile";
import { useBitReposByWorkspace } from "../api/bitbucket-api";
import Repos from "../Repos";
import { ServiceControl, ServiceSetValue } from "../utils";
import Branches from "./Branches";
import WorkSpaces from "./Workspaces";

const Bit = ({
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
      <Branches services={services} control={control} />
    </>
  );
};

export default Bit;
