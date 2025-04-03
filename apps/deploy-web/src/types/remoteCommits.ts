import type { components } from "@octokit/openapi-types";
export type GitCommit = components["schemas"]["commit"];
export interface GitLabCommit {
  id: string;
  title: string;
  message: string;
  authored_date: string;
}

export interface BitBucketCommit {
  values: {
    type: string;
    hash: string;
    date: string;
    message: string;
    author: Author;
  }[];
  pagelen: number;
}

interface Author {
  type: string;
  raw: string;
}
