import React, { Dispatch, useState } from "react";

import { ServiceType } from "@src/types";
import { useBitReposByWorkspace } from "../api/bitbucket-api";
import Repos from "../github/Repos";
import { ServiceControl } from "../utils";
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
  setValue: any;
  services: ServiceType[];
  control: ServiceControl;
  profile: any;
}) => {
  const [workSpace, setWorkSpace] = useState<string>("");

  const { data: repos, isLoading } = useBitReposByWorkspace(workSpace);

  return (
    <>
      <WorkSpaces isLoading={loading} workSpaces={workSpace} setWorkSpaces={setWorkSpace} />
      <Repos
        isLoading={isLoading}
        repos={
          repos?.values.map((repo: any) => ({
            name: repo.name,
            id: repo.id,
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
        profile={profile}
        services={services}
      />
      <Branches services={services} control={control} />
      {/* <Framework services={services} setValue={setValue} /> */}
    </>
  );
};

export default Bit;
