import React, { Dispatch, useState } from "react";

import { ServiceType } from "@src/types";
import { ServiceControl, ServiceSetValue } from "../helper-functions";
import { useGitLabReposByGroup } from "../remote-deploy-api-queries/gitlab-queries";
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
  setValue: ServiceSetValue;
  services: ServiceType[];
  control: ServiceControl;
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
