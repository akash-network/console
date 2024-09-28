import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { protectedEnvironmentVariables, removeInitialUrl } from "../helper-functions";
import { useBitBranches } from "../remote-deploy-api-queries/bit-bucket-queries";
import SelectBranches from "../SelectBranches";

const BitBucketBranches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = removeInitialUrl(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value);

  const { data: branches, isLoading: branchesLoading } = useBitBranches(selected);

  return <SelectBranches control={control} loading={branchesLoading} branches={branches?.values} selected={selected} />;
};

export default BitBucketBranches;
