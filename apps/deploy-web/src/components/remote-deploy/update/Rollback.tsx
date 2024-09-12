import { Control } from "react-hook-form";

import { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { useCommits } from "../api/api";
import { useBitBucketCommits } from "../api/bitbucket-api";
import { useGitLabCommits } from "../api/gitlab-api";
import { removeInitialUrl } from "../utils";
import RollbackModal from "./RollbackModal";

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
    data && data?.length > 0
      ? data.map(commit => ({ name: commit.commit.message, value: commit.sha, date: new Date(commit.commit.author.date) }))
      : labCommits && labCommits?.length > 0
        ? labCommits?.map(commit => ({ name: commit.title, value: commit.id, date: new Date(commit.authored_date) }))
        : bitbucketCommits && bitbucketCommits?.values?.length > 0
          ? bitbucketCommits?.values?.map(commit => ({ name: commit.message, value: commit.hash, date: new Date(commit.date) }))
          : null;

  return <RollbackModal data={commits} control={control} />;
};
export default Rollback;
