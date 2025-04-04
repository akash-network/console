import type { Dispatch } from "react";
import React, { useState } from "react";
import type { Control, UseFormSetValue } from "react-hook-form";

import { useGitLabReposByGroup } from "@src/queries/useGitlabQuery";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import Repos from "../Repos";
import GitlabBranches from "./GitlabBranches";
import Groups from "./Groups";

const GitlabManager = ({
  loading,
  setValue,
  services,
  control,
  setDeploymentName,
  deploymentName
}: {
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  loading: boolean;
  setValue: UseFormSetValue<SdlBuilderFormValuesType>;
  services: ServiceType[];
  control: Control<SdlBuilderFormValuesType>;
}) => {
  const [group, setGroup] = useState<string>("");
  const { data: repos, isLoading } = useGitLabReposByGroup(group);

  return (
    <>
      <Groups isLoading={loading} setGroup={setGroup} />
      <Repos
        services={services}
        isLoading={isLoading}
        repos={
          repos?.map(repo => ({
            name: repo.name,
            id: repo.id?.toString(),
            default_branch: repo?.default_branch,
            html_url: repo?.web_url,
            userName: "gitlab",
            private: repo?.visibility === "private"
          })) ?? []
        }
        setValue={setValue}
        setDeploymentName={setDeploymentName}
        deploymentName={deploymentName}
        type="gitlab"
      />
      <GitlabBranches services={services} control={control} repos={repos} />
    </>
  );
};

export default GitlabManager;
