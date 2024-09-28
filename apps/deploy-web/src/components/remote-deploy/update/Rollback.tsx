import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { RollBackType } from "@src/types/remotedeploy";
import { protectedEnvironmentVariables, removeInitialUrl } from "../helper-functions";
import { useBitBucketCommits } from "../remote-deploy-api-queries/bit-bucket-queries";
import { useCommits } from "../remote-deploy-api-queries/github-queries";
import { useGitLabCommits } from "../remote-deploy-api-queries/gitlab-queries";
import RollbackModal from "./RollbackModal";

const Rollback = ({ services, control }: { services: ServiceType[]; control: Control<SdlBuilderFormValuesType> }) => {
  const { data } = useCommits(
    services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value?.replace("https://github.com/", "") ?? "",
    services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.BRANCH_NAME)?.value ?? ""
  );
  const { data: labCommits } = useGitLabCommits(
    services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.GITLAB_PROJECT_ID)?.value,
    services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.BRANCH_NAME)?.value
  );
  const { data: bitbucketCommits } = useBitBucketCommits(
    removeInitialUrl(services?.[0]?.env?.find(e => e.key === protectedEnvironmentVariables.REPO_URL)?.value ?? "")
  );

  let commits: RollBackType[] | null = null;

  if (data && data?.length > 0) {
    commits = data.map(commit => ({
      name: commit.commit.message,
      value: commit.sha,
      date: new Date(commit.commit.author.date)
    }));
  } else if (labCommits && labCommits?.length > 0) {
    commits = labCommits.map(commit => ({
      name: commit.title,
      value: commit.id,
      date: new Date(commit.authored_date)
    }));
  } else if (bitbucketCommits && bitbucketCommits?.values?.length > 0) {
    commits = bitbucketCommits.values.map(commit => ({
      name: commit.message,
      value: commit.hash,
      date: new Date(commit.date)
    }));
  }

  return <RollbackModal data={commits} control={control} />;
};
export default Rollback;
