import type { Control } from "react-hook-form";

import { useGitLabBranches } from "@src/queries/useGitlabQuery";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import type { GitlabRepo } from "@src/types/remoteRepos";
import SelectBranches from "../SelectBranches";

const GitlabBranches = ({ repos, services, control }: { repos?: GitlabRepo[]; services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected =
    repos && repos?.length > 0
      ? repos?.find(e => e.web_url === services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value)?.id?.toString()
      : services?.[0]?.env?.find(e => e.key === "GITLAB_PROJECT_ID")?.value;

  const { data: branches, isLoading: branchesLoading } = useGitLabBranches(selected);

  return <SelectBranches control={control} selected={selected} loading={branchesLoading} branches={branches} />;
};

export default GitlabBranches;
