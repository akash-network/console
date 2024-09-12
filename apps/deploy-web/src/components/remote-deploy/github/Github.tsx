import { Dispatch } from "react";
import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { GitHubProfile } from "@src/types/remotedeploy";
import { useRepos } from "../api/api";
import Repos from "../Repos";
import { ServiceSetValue } from "../utils";
import Branches from "./Branches";

const Github = ({
  control,
  setValue,
  services,
  setDeploymentName,
  deploymentName,
  profile
}: {
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  control: Control<SdlBuilderFormValuesType>;

  setValue: ServiceSetValue;
  services: ServiceType[];
  profile?: GitHubProfile;
}) => {
  const { data: repos, isLoading } = useRepos();

  return (
    <>
      <Repos
        repos={repos?.filter(repo => repo.owner?.login === profile?.login || repo?.owner?.type === "Organization") as any}
        setValue={setValue}
        isLoading={isLoading}
        services={services}
        setDeploymentName={setDeploymentName}
        deploymentName={deploymentName}
        profile={profile}
      />
      <Branches services={services} control={control} />
    </>
  );
};

export default Github;
