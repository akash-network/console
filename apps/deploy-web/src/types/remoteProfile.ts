import { components } from "@octokit/openapi-types";
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
    repositories: {
      href: string;
    };
    snippets: {
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
  has_2fa_enabled: null;
  username: string;
  is_staff: boolean;
  account_id: string;
  nickname: string;
  account_status: string;
  location: null;
}

export interface GitLabProfile {
  id: number;
  username: string;
  name: string;
  state: string;
  locked: boolean;
  avatar_url: string;
  web_url: string;
  created_at: string;
  bio: string;
  location: string;
  public_email: string;
  skype: string;
  linkedin: string;
  twitter: string;
  discord: string;
  website_url: string;
  organization: string;
  job_title: string;
  pronouns: string;
  bot: boolean;
  work_information: string;
  local_time: string;
  last_sign_in_at: string;
  confirmed_at: string;
  last_activity_on: string;
  email: string;
  theme_id: number;
  color_scheme_id: number;
  projects_limit: number;
  current_sign_in_at: string;
  identities: {
    provider: string;
    extern_uid: string;
    saml_provider_id: string;
  }[];
  can_create_group: boolean;
  can_create_project: boolean;
  two_factor_enabled: boolean;
  external: boolean;
  private_profile: boolean;
  commit_email: string;
  shared_runners_minutes_limit: string;
  extra_shared_runners_minutes_limit: string;
}
