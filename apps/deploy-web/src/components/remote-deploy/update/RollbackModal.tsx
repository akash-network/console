import React, { useEffect, useState } from "react";
import { Control, useFieldArray } from "react-hook-form";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@akashnetwork/ui/components";
import { GitCommitVertical, GitGraph, Info } from "lucide-react";
import { nanoid } from "nanoid";

import { SdlBuilderFormValuesType } from "@src/types";
import { RollBackType } from "@src/types/remotedeploy";
import { protectedEnvironmentVariables } from "../helper-functions";

const RollbackModal = ({ data, control }: { data?: RollBackType[] | null; control: Control<SdlBuilderFormValuesType> }) => {
  const [filteredData, setFilteredData] = useState<RollBackType[]>([]);
  const [value, setValue] = useState<string>("");
  const { fields: services } = useFieldArray({ control, name: "services", keyName: "id" });
  const { append, update } = useFieldArray({ control, name: "services.0.env", keyName: "id" });
  const currentHash = services[0]?.env?.find(e => e.key === protectedEnvironmentVariables.COMMIT_HASH);
  useEffect(() => {
    if (data) {
      setFilteredData(
        data?.filter(item => {
          return item.name.toLowerCase().includes(value.toLowerCase());
        })
      );
    }
  }, [data, value]);

  return (
    <div className="flex items-center gap-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="line-clamp-1 flex w-full justify-between bg-popover">
            <span>{currentHash?.value ? data?.find(item => item.value === currentHash?.value)?.name ?? currentHash?.value : "Select"}</span>
            <GitGraph size={18} />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-[20] border-b bg-popover p-5">
            <DialogTitle>Rollbacks</DialogTitle>
            <DialogDescription className="mt-1 flex items-center gap-2">
              <Info className="h-4 w-4" />
              You need to click update deployment button to apply changes
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="git">
            <TabsList className="mx-5 mt-4">
              <TabsTrigger value="git">Commit Name</TabsTrigger>
              <TabsTrigger value="Custom">Commit Hash</TabsTrigger>
            </TabsList>
            <TabsContent value="git" className="mt-0 flex flex-col gap-6">
              <div className="flex flex-col">
                <div className="flex border-b px-5 py-4">
                  <Input
                    placeholder="Search"
                    className="w-full"
                    value={value}
                    onChange={e => {
                      setValue(e.target.value);
                    }}
                  />
                </div>
                {filteredData?.length > 0 ? (
                  <RadioGroup
                    value={currentHash?.value}
                    onValueChange={value => {
                      const hash = { id: nanoid(), key: protectedEnvironmentVariables.COMMIT_HASH, value: value, isSecret: false };

                      if (currentHash) {
                        update(services[0]?.env?.findIndex(e => e.key === protectedEnvironmentVariables.COMMIT_HASH) as number, hash);
                      } else {
                        append(hash);
                      }
                    }}
                  >
                    {filteredData?.map(item => (
                      <div className="flex justify-between gap-4 border-b px-5 py-4" key={item.value}>
                        <Label htmlFor={item.value} className="flex flex-1 items-center gap-3 text-sm">
                          <GitCommitVertical />
                          <p className="flex-1">{item.name}</p>
                        </Label>
                        <RadioGroupItem value={item.value} id={item.value} />
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <></>
                )}
              </div>
            </TabsContent>
            <TabsContent value="Custom" className="mt-2 flex flex-col gap-6 px-5 py-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="manual">Commit Hash</Label>
                <Input
                  value={currentHash?.value}
                  placeholder="Commit Hash"
                  onChange={e => {
                    const hash = { id: nanoid(), key: protectedEnvironmentVariables.COMMIT_HASH, value: e.target.value, isSecret: false };
                    if (currentHash) {
                      update(services[0]?.env?.findIndex(e => e.key === protectedEnvironmentVariables.COMMIT_HASH) as number, hash);
                    } else {
                      append(hash);
                    }
                  }}
                />
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RollbackModal;
