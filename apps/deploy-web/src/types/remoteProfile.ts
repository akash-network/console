import type { components } from "@octokit/openapi-types";
export type GitHubProfile = components["schemas"]["simple-user"];

export interface BitProfile {
  display_name: string;
  links: {
    self: {
      href: string;
    };
    avatar: {
      href: string;
    };

    html: {
      href: string;
    };
    hooks: {
      href: string;
    };
  };
  created_on: string;
  type: string;
  uuid: string;

  username: string;

  account_id: string;
  nickname: string;
  account_status: string;
  location: null;
}

export interface GitLabProfile {
  id: number;
  username: string;
  name: string;

  avatar_url: string;
  web_url: string;
  created_at: string;
  bio: string;
  location: string;
  public_email: string;

  last_activity_on: string;
  email: string;
}
