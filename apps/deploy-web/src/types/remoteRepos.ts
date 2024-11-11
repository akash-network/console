interface RepositoryLinks {
  self: Link;
  html: Link;
  avatar: Link;
  pullrequests: Link;
  commits: Link;
  forks: Link;
  watchers: Link;
  branches: Link;
  tags: Link;
  downloads: Link;
  source: Link;
  hooks: Link;
}

interface Link {
  href: string;
}

interface RepositoryOwner {
  display_name: string;
  links: {
    self: Link;
    avatar: Link;
    html: Link;
  };
  type: string;
  uuid: string;
  username: string;
}

export interface BitWorkspace {
  type: string;
  uuid: string;
  name: string;
  slug: string;
  links: {
    avatar: Link;
    html: Link;
    self: Link;
  };
}

interface Project {
  type: string;
  key: string;
  uuid: string;
  name: string;
  links: {
    self: Link;
    html: Link;
    avatar: Link;
  };
}

interface MainBranch {
  name: string;
  type: string;
}

export interface BitRepository {
  type: string;
  full_name: string;
  links: RepositoryLinks;
  name: string;
  slug: string;
  description: string;
  scm: string;
  website: string | null;
  owner: RepositoryOwner;
  workspace: BitWorkspace;
  is_private: boolean;
  project: Project;
  fork_policy: string;
  created_on: string;
  updated_on: string;
  size: number;
  language: string;
  uuid: string;
  mainbranch: MainBranch;
  parent: null | string;
}

export interface GitlabRepo {
  id: number;
  description: string;
  name: string;
  created_at: string;
  default_branch: string;
  web_url: string;
  readme_url: string;
  forks_count: number;
  avatar_url: string | null;
  star_count: number;
  last_activity_at: string;
  container_registry_image_prefix: string;
  packages_enabled: boolean;
  empty_repo: boolean;
  archived: boolean;
  visibility: string;
}

export interface GitlabGroup {
  id: number;
  web_url: string;
  name: string;
  path: string;
  description: string;
  visibility: string;
  default_branch: string | null;
  default_branch_protection: number;
  avatar_url: string | null;
  request_access_enabled: boolean;
  full_name: string;
  full_path: string;
  created_at: string;
}
