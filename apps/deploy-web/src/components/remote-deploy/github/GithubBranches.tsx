import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { protectedEnvironmentVariables, removeInitialUrl } from "../helper-functions";
import { useBranches } from "../remote-deploy-api-queries/github-queries";
import SelectBranches from "../SelectBranches";

const GithubBranches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = removeInitialUrl(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value);

  const { data: branches, isLoading: branchesLoading } = useBranches(selected);

  return <SelectBranches control={control} loading={branchesLoading} branches={branches} selected={selected} />;
};

export default GithubBranches;
