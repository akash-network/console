import { useCallback, useEffect, useState } from "react";

import { supportedFrameworks } from "@src/config/remote-deploy.config";
import { useBitPackageJson } from "@src/queries/useBitBucketQuery";
import { usePackageJson } from "@src/queries/useGithubQuery";
import { useGitlabPackageJson } from "@src/queries/useGitlabQuery";
import { formatUrlWithoutInitialPath } from "@src/services/remote-deploy/remote-deployment-controller.service";
import { PackageJson } from "@src/types/remotedeploy";

const useRemoteDeployFramework = ({
  currentRepoUrl,
  currentBranchName,
  currentGitlabProjectId,
  subFolder,
  setCpus
}: {
  currentRepoUrl?: string;
  currentBranchName?: string;
  currentGitlabProjectId?: string;
  subFolder?: string;
  setCpus: (cpu: number) => void;
}) => {
  const setValueHandler = useCallback(
    (data: PackageJson) => {
      if (data?.dependencies) {
        setPackageJson(data);
        const cpus = (Object.keys(data?.dependencies ?? {})?.length / 10 / 2)?.toFixed(1);

        setCpus(+cpus > 2 ? +cpus : 2);
      } else {
        setPackageJson(null);
      }
    },
    [setCpus]
  );

  const [packageJson, setPackageJson] = useState<PackageJson | null>(null);

  const {
    isLoading,
    data: { content: packageJsonContent }
  } = usePackageJson(formatUrlWithoutInitialPath(currentRepoUrl), subFolder);
  useEffect(() => {
    if (packageJsonContent === undefined) {
      setValueHandler(JSON.parse(atob(packageJsonContent)));
    }
  }, [packageJsonContent, setValueHandler]);

  const {
    isLoading: gitlabLoading,
    isFetching,
    data: { content: gitlabPackageJsonContent }
  } = useGitlabPackageJson(currentGitlabProjectId, subFolder);
  useEffect(() => {
    if (gitlabPackageJsonContent === undefined) {
      setValueHandler(JSON.parse(atob(gitlabPackageJsonContent)));
    }
  }, [gitlabPackageJsonContent, setValueHandler]);

  const { isLoading: bitbucketLoading, data: bitbucketPackageJson } = useBitPackageJson(
    formatUrlWithoutInitialPath(currentRepoUrl),
    currentBranchName,
    subFolder
  );
  useEffect(() => {
    if (bitbucketPackageJson) {
      setValueHandler(bitbucketPackageJson);
    }
  }, [bitbucketPackageJson, setValueHandler]);

  return {
    currentFramework: supportedFrameworks.find(f => packageJson?.scripts?.dev?.includes(f.value)) ?? {
      title: "Other",
      value: "other"
    },
    isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
  };
};

export default useRemoteDeployFramework;
