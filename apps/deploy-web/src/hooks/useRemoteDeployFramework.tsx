import { useState } from "react";

import { removeInitialUrl, ServiceSetValue, supportedFrameworks } from "@src/components/remote-deploy/helper-functions";
import { useBitPackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/bit-bucket-queries";
import { usePackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/github-queries";
import { useGitlabPackageJson } from "@src/components/remote-deploy/remote-deploy-api-queries/gitlab-queries";
import { ServiceType } from "@src/types";
import { PackageJson } from "@src/types/remotedeploy";

const useRemoteDeployFramework = ({
  services,
  setValue,
  subFolder
}: {
  services: ServiceType[];
  setValue: ServiceSetValue;

  subFolder?: string;
}) => {
  const [data, setData] = useState<PackageJson | null>(null);
  const selected = services?.[0]?.env?.find(e => e.key === "REPO_URL")?.value;

  const setValueHandler = (data: PackageJson) => {
    if (data?.dependencies) {
      setData(data);
      const cpus = (Object.keys(data?.dependencies ?? {})?.length / 10 / 2)?.toFixed(1);

      setValue("services.0.profile.cpu", +cpus > 2 ? +cpus : 2);
    } else {
      setData(null);
    }
  };

  const { isLoading } = usePackageJson(setValueHandler, removeInitialUrl(selected), subFolder);
  const { isLoading: gitlabLoading, isFetching } = useGitlabPackageJson(
    setValueHandler,
    services?.[0]?.env?.find(e => e.key === "GITLAB_PROJECT_ID")?.value,
    subFolder
  );

  const { isLoading: bitbucketLoading } = useBitPackageJson(
    setValueHandler,
    removeInitialUrl(selected),
    services?.[0]?.env?.find(e => e.key === "BRANCH_NAME")?.value,
    subFolder
  );

  return {
    currentFramework: supportedFrameworks.find(f => data?.scripts?.dev?.includes(f.value)) ?? {
      title: "Other",
      value: "other"
    },
    isLoading: isLoading || gitlabLoading || bitbucketLoading || isFetching
  };
};

export default useRemoteDeployFramework;
