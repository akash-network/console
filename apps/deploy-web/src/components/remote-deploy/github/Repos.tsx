import { Dispatch, useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  RadioGroup,
  RadioGroupItem,
  Spinner
} from "@akashnetwork/ui/components";
import { Folder, GithubCircle, Lock } from "iconoir-react";
import { useAtom } from "jotai";
import { Globe2 } from "lucide-react";
import { nanoid } from "nanoid";

import remoteDeployStore from "@src/store/remoteDeployStore";
import { ServiceType } from "@src/types";
import { useSrcFolders } from "../api/api";
import { useBitSrcFolders } from "../api/bitbucket-api";
import { useGitlabSrcFolders } from "../api/gitlab-api";
import CustomInput from "../CustomInput";
import useFramework from "../FrameworkDetection";
import { IGithubDirectoryItem } from "../remoteTypes";
import { appendEnv, removeInitialUrl } from "../utils";
// import { handleLogin } from "../api/api";
const Repos = ({
  repos,
  setValue,
  isLoading,
  services,
  setDeploymentName,
  profile,
  type = "github"
}: {
  repos: any;
  setValue: any;
  services: ServiceType[];
  isLoading: boolean;
  setDeploymentName: Dispatch<string>;
  deploymentName: string;
  profile: any;
  type?: "github" | "gitlab" | "bitbucket";
}) => {
  const [token] = useAtom(remoteDeployStore.tokens);
  const [search, setSearch] = useState("");
  const [filteredRepos, setFilteredRepos] = useState(repos);
  const currentRepo = services?.[0]?.env?.find(e => e.key === "REPO_URL");
  const repo = repos?.find(r => r.html_url === currentRepo?.value);
  const [directory, setDirectory] = useState<IGithubDirectoryItem[] | null>(null);
  const currentFolder = services?.[0]?.env?.find(e => e.key === "FRONTEND_FOLDER");
  const { currentFramework } = useFramework({
    services,
    setValue,
    repos,
    subFolder: currentFolder?.value
  });

  const setFolders = (data: IGithubDirectoryItem[]) => {
    if (data?.length > 0) {
      setDirectory(data);
    } else {
      setDirectory(null);
    }
  };

  const { isLoading: isGettingDirectory, isFetching: isGithubLoading } = useSrcFolders(setFolders, removeInitialUrl(currentRepo?.value));

  const { isLoading: isGettingDirectoryBit, isFetching: isBitLoading } = useBitSrcFolders(
    setFolders,
    removeInitialUrl(currentRepo?.value),
    services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")?.value
  );

  const { isLoading: isGettingDirectoryGitlab, isFetching: isGitlabLoading } = useGitlabSrcFolders(
    setFolders,
    services?.[0]?.env?.find(e => e.key === "GITLAB_PROJECT_ID")?.value
  );
  const isLoadingDirectories = isGithubLoading || isGitlabLoading || isBitLoading || isGettingDirectory || isGettingDirectoryBit || isGettingDirectoryGitlab;
  console.log(repo?.owner?.login, profile?.login, "sdf");

  useEffect(() => {
    setFilteredRepos(repos);
  }, [repos]);
  return (
    <div className="flex flex-col gap-5 rounded border bg-card px-6 py-6 text-card-foreground">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold">Select Repository</h1>
        <p className="text-muted-foreground">The Repository Branch used for your private service</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="flex justify-between bg-card">
            <div className="flex items-center gap-2">
              {currentFramework && currentFramework?.image ? (
                <img src={currentFramework.image} alt={currentFramework.title} className="h-6 w-6" />
              ) : (
                <Globe2 size={20} />
              )}
              <p>{repo?.name || "Select Repository"}</p>
            </div>
            <Folder />
          </Button>
        </DialogTrigger>
        <DialogContent hideCloseButton className="max-h-[80dvh] gap-0 overflow-y-auto p-0 sm:max-w-[525px]">
          <DialogHeader className="sticky top-0 z-[5] flex flex-col gap-4 bg-popover px-5 pb-4 pt-6">
            <DialogTitle>Search Repository</DialogTitle>
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setFilteredRepos(repos.filter((repo: any) => repo.name.includes(e.target.value)));
              }}
            />
          </DialogHeader>
          <div className="flex flex-col">
            {filteredRepos
              ?.filter((repo: any) => repo.owner?.login === profile?.login || type !== "github")
              ?.map((repo: any) => (
                <div key={repo.html_url} className="flex flex-col gap-3 border-b px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        {currentFramework && currentRepo?.value === repo.html_url ? (
                          currentFramework?.image ? (
                            <img src={currentFramework.image} alt={currentFramework.title} className="h-6 w-6" />
                          ) : (
                            <Globe2 size={22} />
                          )
                        ) : (
                          <GithubCircle />
                        )}
                        <p>{repo.name}</p>
                        {repo.private && <Lock className="ml-1 text-xs" />}
                      </div>
                    </div>
                    {currentRepo?.value === repo?.html_url ? (
                      <Button variant="default" size="sm">
                        Done
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={currentRepo?.value === repo.html_url}
                        onClick={() => {
                          setDirectory(null);
                          const repoUrl = { id: nanoid(), key: "REPO_URL", value: repo.html_url, isSecret: false };
                          const branchName = { id: nanoid(), key: "BRANCH_NAME", value: repo.default_branch, isSecret: false };
                          if (type === "github") {
                            setValue("services.0.env", [
                              repoUrl,
                              branchName,

                              { id: nanoid(), key: "GITHUB_ACCESS_TOKEN", value: token?.access_token, isSecret: false }
                            ]);
                          }
                          if (type === "bitbucket") {
                            setValue("services.0.env", [
                              repoUrl,
                              branchName,
                              { id: nanoid(), key: "BITBUCKET_ACCESS_TOKEN", value: token?.access_token, isSecret: false },
                              { id: nanoid(), key: "BITBUCKET_USER", value: repo?.username, isSecret: false }
                            ]);
                          }
                          if (type === "gitlab") {
                            setValue("services.0.env", [
                              repoUrl,
                              branchName,
                              { id: nanoid(), key: "GITLAB_ACCESS_TOKEN", value: token?.access_token, isSecret: false },
                              {
                                id: nanoid(),
                                key: "GITLAB_PROJECT_ID",
                                value: repo?.id?.toString(),
                                isSecret: false
                              }
                            ]);
                          }
                          setDeploymentName(repo.name);
                        }}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                  {isLoadingDirectories && currentRepo?.value === repo.html_url && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">Fetching Directory</p>
                      <Spinner size="small" />
                    </div>
                  )}
                  {currentRepo?.value === repo.html_url &&
                    !isLoadingDirectories &&
                    (directory && directory?.filter(item => item.type === "dir" || item.type === "commit_directory" || item.type === "tree")?.length > 0 ? (
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between pb-3">
                          <p className="text-muted-foregroun4 text-sm">Select Directory</p>
                          {/* <p className="text-sm text-muted-foreground"> {currentFramework?.title}</p> */}
                        </div>

                        <RadioGroup
                          className=""
                          onValueChange={value => {
                            appendEnv("FRONTEND_FOLDER", value, false, setValue, services);
                          }}
                          value={currentFolder?.value}
                        >
                          {directory
                            ?.filter(item => item.type === "dir" || item.type === "commit_directory" || item.type === "tree")
                            .map(item => (
                              <div className="flex items-center justify-between py-0.5" key={item.path}>
                                <Label htmlFor={item.path} className="flex items-center gap-2">
                                  <Folder />
                                  {item.path}
                                </Label>
                                <RadioGroupItem value={item.path} id={item.path} />
                              </div>
                            ))}
                        </RadioGroup>
                      </div>
                    ) : (
                      <CustomInput
                        onChange={e => appendEnv("FRONTEND_FOLDER", e.target.value, false, setValue, services)}
                        label="Frontend Folder"
                        description="By default we use ./, Change the version if needed"
                        placeholder="eg. app"
                      />
                    ))}
                </div>
              ))}
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Spinner size="medium" />
              </div>
            )}
            {filteredRepos?.length === 0 && <div className="flex items-center justify-center p-4">No Repository Found</div>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Repos;
