import { Dispatch } from "react";
import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { GitHubProfile } from "@src/types/remoteProfile";
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
        repos={repos
          ?.filter(repo => repo.owner?.login === profile?.login || repo?.owner?.type === "Organization")
          ?.map(repo => ({
            name: repo.name,
            default_branch: repo?.default_branch,
            html_url: repo?.html_url,
            private: repo?.private,
            id: repo.id?.toString(),
            owner: repo?.owner
          }))}
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
