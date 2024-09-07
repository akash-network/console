import { Control, useFieldArray } from "react-hook-form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { nanoid } from "nanoid";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useBitBranches } from "../api/bitbucket-api";
import { removeInitialUrl } from "../utils";

const Branches = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const selected = removeInitialUrl(services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value);

  const { data: branches, isLoading: branchesLoading } = useBitBranches(selected);

  const { fields, append, update } = useFieldArray({
    control,
    name: "services.0.env",
    keyName: "id"
  });
  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Branch</h1>
        <p className="text-muted-foreground">Select a branch to use for deployment</p>
      </div>

      <Select
        disabled={!selected}
        value={fields.find(e => e.key === "BRANCH_NAME")?.value}
        onValueChange={value => {
          const branch = { id: nanoid(), key: "BRANCH_NAME", value: value, isSecret: false };
          if (fields.find(e => e.key === "BRANCH_NAME")) {
            update(
              fields.findIndex(e => e.key === "BRANCH_NAME"),
              branch
            );
          } else {
            append(branch);
          }
        }}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {branchesLoading && <Spinner size="small" />}
            <SelectValue placeholder="Select" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {branches?.values?.map((branch: any) => (
              <SelectItem key={branch.name} value={branch.name}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
};

export default Branches;
