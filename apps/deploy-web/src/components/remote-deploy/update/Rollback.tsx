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

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useCommits } from "../api/api";
import { useBitBucketCommits } from "../api/bitbucket-api";
import { useGitLabCommits } from "../api/gitlab-api";
import { removeInitialUrl } from "../utils";

const Rollback = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const { data } = useCommits(
    services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value?.replace("https://github.com/", "") ?? "",
    services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")?.value ?? ""
  );
  const { data: labCommits } = useGitLabCommits(
    services?.[0]?.env?.find(e => e.key === "GITLAB_PROJECT_ID")?.value,
    services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")?.value
  );
  const { data: bitbucketCommits } = useBitBucketCommits(removeInitialUrl(services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value ?? ""));

  const commits =
    data?.length > 0
      ? data.map(commit => ({ name: commit.commit.message, value: commit.sha, date: new Date(commit.commit.author.date) }))
      : labCommits?.length > 0
        ? labCommits?.map(commit => ({ name: commit.title, value: commit.id, date: new Date(commit.authored_date) }))
        : bitbucketCommits?.values?.map(commit => ({ name: commit.message, value: commit.hash, date: new Date(commit.date) }));

  return <Field data={commits} control={control} />;
};
export default Rollback;

const Field = ({ data, control }: { data: any; control: Control<SdlBuilderFormValuesType> }) => {
  const { fields: services } = useFieldArray({ control, name: "services", keyName: "id" });
  const { append, update } = useFieldArray({ control, name: "services.0.env", keyName: "id" });
  const [value, setValue] = useState<string>("");

  const [filteredData, setFilteredData] = useState<any>([]);
  const currentHash = services[0]?.env?.find(e => e.key === "COMMIT_HASH")?.value;
  useEffect(() => {
    if (data) {
      setFilteredData(
        data?.filter((item: any) => {
          return item.name.toLowerCase().includes(value.toLowerCase());
        })
      );
    }
  }, [data, value]);

  return (
    <div className="flex items-center gap-6">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex w-full justify-between bg-popover">
            <span>{currentHash ? data?.find((item: any) => item.value === currentHash)?.name ?? currentHash : "Select"}</span>
            <GitGraph size={18} />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-[20] border-b bg-popover p-5">
            <DialogTitle>Rollbacks</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              You need to click update deployment button to apply changes
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="git">
            <TabsList className="mx-5 mt-4">
              <TabsTrigger value="git">Git</TabsTrigger>
              <TabsTrigger value="Custom">Custom</TabsTrigger>
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
                      //   setFilteredData(data.filter((item: any) => item.name.toLowerCase().includes(e.target.value.toLowerCase())));
                    }}
                  />
                </div>
                {filteredData?.length > 0 ? (
                  <RadioGroup
                    value={services[0]?.env?.find(e => e.key === "COMMIT_HASH")?.value}
                    onValueChange={value => {
                      const hash = { id: nanoid(), key: "COMMIT_HASH", value: value, isSecret: false };
                      //   enqueueSnackbar(<Snackbar title={"Info"} subTitle="You need to click update deployment button to apply changes" iconVariant="info" />, {
                      //     variant: "info"
                      //   });
                      if (services[0]?.env?.find(e => e.key === "COMMIT_HASH")) {
                        update(
                          services[0]?.env?.findIndex(e => e.key === "COMMIT_HASH"),
                          hash
                        );
                      } else {
                        append(hash);
                      }
                    }}
                  >
                    {filteredData?.map((item: any) => (
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
                  value={services[0]?.env?.find(e => e.key === "COMMIT_HASH")?.value}
                  placeholder="Commit Hash"
                  onChange={e => {
                    const hash = { id: nanoid(), key: "COMMIT_HASH", value: e.target.value, isSecret: false };
                    if (services[0]?.env?.find(e => e.key === "COMMIT_HASH")) {
                      update(
                        services[0]?.env?.findIndex(e => e.key === "COMMIT_HASH"),
                        hash
                      );
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
      {/* {manual ? (
          <Input
            value={services[0]?.env?.find(e => e.key === "COMMIT_HASH")?.value}
            placeholder="Commit Hash"
            onChange={e => {
              const hash = { id: nanoid(), key: "COMMIT_HASH", value: e.target.value, isSecret: false };
              if (services[0]?.env?.find(e => e.key === "COMMIT_HASH")) {
                update(
                  services[0]?.env?.findIndex(e => e.key === "COMMIT_HASH"),
                  hash
                );
              } else {
                append(hash);
              }
            }}
          />
        ) : (
          <Select
            value={services[0]?.env?.find(e => e.key === "COMMIT_HASH")?.value}
            onValueChange={(value: any) => {
              const hash = { id: nanoid(), key: "COMMIT_HASH", value: value, isSecret: false };
              enqueueSnackbar(<Snackbar title={"Info"} subTitle="You need to click update deployment button to apply changes" iconVariant="info" />, {
                variant: "info"
              });
              if (services[0]?.env?.find(e => e.key === "COMMIT_HASH")) {
                update(
                  services[0]?.env?.findIndex(e => e.key === "COMMIT_HASH"),
                  hash
                );
              } else {
                append(hash);
              }
            }}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <SelectValue placeholder={"Select"} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {data?.map((repo: any) => (
                  <SelectItem key={repo.value} value={repo.value}>
                    <div className="flex items-center">
                      <GitCommit className="mr-2" /> {repo?.name?.split("\n")[0]}{" "}
                      <p className="ml-2 text-xs text-muted-foreground">{new Date(repo?.date).toLocaleDateString()}</p>{" "}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <Switch
          onCheckedChange={checked => {
            setManual(checked);
          }}
          checked={manual}
        />{" "} */}
    </div>
  );
};
