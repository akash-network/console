import type { Control } from "react-hook-form";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { useBranches } from "@src/queries/useGithubQuery";
import { formatUrlWithoutInitialPath } from "@src/services/remote-deploy/remote-deployment-controller.service";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import SelectBranches from "../SelectBranches";

const GithubBranches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = formatUrlWithoutInitialPath(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value);

  const { data: branches, isLoading: branchesLoading } = useBranches(selected);

  return <SelectBranches control={control} loading={branchesLoading} branches={branches} selected={selected} />;
};

export default GithubBranches;
