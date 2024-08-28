import { Dispatch } from "react";
import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useRepos } from "../api/api";
import Branches from "./Branches";
import Repos from "./Repos";

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

  setValue: any;
  services: ServiceType[];
  profile: any;
}) => {
  const { data: repos, isLoading } = useRepos();

  return (
    <>
      <Repos
        repos={repos as any}
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
