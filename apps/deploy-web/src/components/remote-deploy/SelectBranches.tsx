import React from "react";
import type { Control } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";
import { nanoid } from "nanoid";

import { CURRENT_SERVICE, protectedEnvironmentVariables } from "@src/config/remote-deploy.config";
import type { SdlBuilderFormValuesType } from "@src/types";

const SelectBranches = ({
  control,

  loading,
  branches,
  selected
}: {
  control: Control<SdlBuilderFormValuesType>;
  loading: boolean;
  branches?: {
    name: string;
  }[];
  selected?: string;
}) => {
  const { fields, append, update } = useFieldArray({
    control,
    name: CURRENT_SERVICE,
    keyName: "id"
  });

  const currentBranch = fields.find(e => e.key === protectedEnvironmentVariables.BRANCH_NAME);
  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Branch</h1>
        <p className="text-muted-foreground">Select a branch to use for deployment</p>
      </div>

      <Select
        disabled={!selected}
        value={currentBranch?.value}
        onValueChange={value => {
          const branch = { id: nanoid(), key: protectedEnvironmentVariables.BRANCH_NAME, value: value, isSecret: false };
          if (currentBranch) {
            update(
              fields.findIndex(e => e.key === protectedEnvironmentVariables.BRANCH_NAME),
              branch
            );
          } else {
            append(branch);
          }
        }}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            {loading && <Spinner size="small" />}
            <SelectValue placeholder="Select" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {branches?.map(branch => (
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

export default SelectBranches;
