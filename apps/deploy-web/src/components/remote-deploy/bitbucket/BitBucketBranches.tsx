import type { Control } from "react-hook-form";

import { protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import { formatUrlWithoutInitialPath } from "@src/services/remote-deploy/remote-deployment-controller.service";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useBitBranches } from "../../../queries/useBitBucketQuery";
import SelectBranches from "../SelectBranches";

const BitBucketBranches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = formatUrlWithoutInitialPath(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value);

  const { data: branches, isLoading: branchesLoading } = useBitBranches(selected);

  return <SelectBranches control={control} loading={branchesLoading} branches={branches?.values} selected={selected} />;
};

export default BitBucketBranches;
