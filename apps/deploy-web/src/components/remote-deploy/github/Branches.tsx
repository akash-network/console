import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useBranches } from "../api/api";
import SelectBranches from "../SelectBranches";
import { removeInitialUrl } from "../utils";

const Branches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = removeInitialUrl(services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value);

  const { data: branches, isLoading: branchesLoading } = useBranches(selected);

  return <SelectBranches control={control} loading={branchesLoading} branches={branches} selected={selected} />;
};

export default Branches;
