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
  clone: CloneLink[];
  hooks: Link;
}

interface Link {
  href: string;
}

interface CloneLink extends Link {
  name: string;
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

interface OverrideSettings {
  default_merge_strategy: boolean;
  branching_model: boolean;
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
  override_settings: OverrideSettings;
  parent: null | string;
}

interface Namespace {
  id: number;
  name: string;
  path: string;
  kind: string;
  full_path: string;
  parent_id: number | null;
  avatar_url: string | null;
  web_url: string;
}

interface Links {
  self: string;
  issues: string;
  merge_requests: string;
  repo_branches: string;
  labels: string;
  events: string;
  members: string;
  cluster_agents: string;
}

interface ContainerExpirationPolicy {
  cadence: string;
  enabled: boolean;
  keep_n: number;
  older_than: string;
  name_regex: string;
  name_regex_keep: string | null;
  next_run_at: string;
}

export interface GitlabRepo {
  id: number;
  description: string;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  created_at: string;
  default_branch: string;
  tag_list: string[];
  topics: string[];
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  web_url: string;
  readme_url: string;
  forks_count: number;
  avatar_url: string | null;
  star_count: number;
  last_activity_at: string;
  namespace: Namespace;
  container_registry_image_prefix: string;
  _links: Links;
  packages_enabled: boolean;
  empty_repo: boolean;
  archived: boolean;
  visibility: string;
  resolve_outdated_diff_discussions: boolean;
  container_expiration_policy: ContainerExpirationPolicy;
  repository_object_format: string;
  issues_enabled: boolean;
  merge_requests_enabled: boolean;
  wiki_enabled: boolean;
  jobs_enabled: boolean;
  snippets_enabled: boolean;
  container_registry_enabled: boolean;
  service_desk_enabled: boolean;
  service_desk_address: string;
  can_create_merge_request_in: boolean;
  issues_access_level: string;
  repository_access_level: string;
  merge_requests_access_level: string;
  forking_access_level: string;
  wiki_access_level: string;
  builds_access_level: string;
  snippets_access_level: string;
  pages_access_level: string;
  analytics_access_level: string;
  container_registry_access_level: string;
  security_and_compliance_access_level: string;
  releases_access_level: string;
  environments_access_level: string;
  feature_flags_access_level: string;
  infrastructure_access_level: string;
  monitor_access_level: string;
  model_experiments_access_level: string;
  model_registry_access_level: string;
  emails_disabled: boolean;
  emails_enabled: boolean;
  shared_runners_enabled: boolean;
  lfs_enabled: boolean;
  creator_id: number;
  import_url: string;
  import_type: string;
  import_status: string;
  open_issues_count: number;
  description_html: string;
  updated_at: string;
  ci_default_git_depth: number;
  ci_forward_deployment_enabled: boolean;
  ci_forward_deployment_rollback_allowed: boolean;
  ci_job_token_scope_enabled: boolean;
  ci_separated_caches: boolean;
  ci_allow_fork_pipelines_to_run_in_parent_project: boolean;
  ci_id_token_sub_claim_components: string[];
  build_git_strategy: string;
  keep_latest_artifact: boolean;
  restrict_user_defined_variables: boolean;
  ci_pipeline_variables_minimum_override_role: string;
  runners_token: string | null;
  runner_token_expiration_interval: string | null;
  group_runners_enabled: boolean;
  auto_cancel_pending_pipelines: string;
  build_timeout: number;
  auto_devops_enabled: boolean;
  auto_devops_deploy_strategy: string;
  ci_push_repository_for_job_token_allowed: boolean;
  ci_config_path: string;
  public_jobs: boolean;
  shared_with_groups: string[];
  only_allow_merge_if_pipeline_succeeds: boolean;
  allow_merge_on_skipped_pipeline: string | null;
  request_access_enabled: boolean;
  only_allow_merge_if_all_discussions_are_resolved: boolean;
  remove_source_branch_after_merge: boolean;
  printing_merge_request_link_enabled: boolean;
  merge_method: string;
  squash_option: string;
  enforce_auth_checks_on_uploads: boolean;
  suggestion_commit_message: string | null;
  merge_commit_template: string | null;
  squash_commit_template: string | null;
  issue_branch_template: string | null;
  warn_about_potentially_unwanted_characters: boolean;
  autoclose_referenced_issues: boolean;
  external_authorization_classification_label: string;
  requirements_enabled: boolean;
  requirements_access_level: string;
  security_and_compliance_enabled: boolean;
  pre_receive_secret_detection_enabled: boolean;
  compliance_frameworks: string[];
}

interface DefaultBranchProtectionDefaults {
  allowed_to_push: Array<{ access_level: number }>;
  allow_force_push: boolean;
  allowed_to_merge: Array<{ access_level: number }>;
}

export interface GitlabGroup {
  id: number;
  web_url: string;
  name: string;
  path: string;
  description: string;
  visibility: string;
  share_with_group_lock: boolean;
  require_two_factor_authentication: boolean;
  two_factor_grace_period: number;
  project_creation_level: string;
  auto_devops_enabled: boolean | null;
  subgroup_creation_level: string;
  emails_disabled: boolean;
  emails_enabled: boolean;
  mentions_disabled: boolean | null;
  lfs_enabled: boolean;
  math_rendering_limits_enabled: boolean;
  lock_math_rendering_limits_enabled: boolean;
  default_branch: string | null;
  default_branch_protection: number;
  default_branch_protection_defaults: DefaultBranchProtectionDefaults;
  avatar_url: string | null;
  request_access_enabled: boolean;
  full_name: string;
  full_path: string;
  created_at: string;
  parent_id: number | null;
  organization_id: number;
  shared_runners_setting: string;
  ldap_cn: string | null;
  ldap_access: string | null;
  wiki_access_level: string;
}
