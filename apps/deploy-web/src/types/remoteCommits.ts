export interface GitCommit {
  sha: string;
  node_id: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
    comment_count: number;
    verification: {
      verified: boolean;
      reason: string;
      signature: string | null;
      payload: string | null;
    };
  };
  url: string;
  html_url: string;
  comments_url: string;
  author: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
  };
  committer: {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
  };
  parents: {
    sha: string;
    url: string;
    html_url: string;
  }[];
}

export interface GitLabCommit {
  id: string;
  short_id: string;
  created_at: string;
  parent_ids: string[];
  title: string;
  message: string;
  author_name: string;
  author_email: string;
  authored_date: string;
  committer_name: string;
  committer_email: string;
  committed_date: string;
  web_url: string;
}

export interface BitBucketCommit {
  values: {
    type: string;
    hash: string;
    date: string;
    author: Author;
    message: string;
    summary: Summary;
    links: CommitLinks;
    parents: Parent[];
    rendered: RenderedMessage;
    repository: Repository;
  }[];
  pagelen: number;
}

interface Author {
  type: string;
  raw: string;
}

interface Summary {
  type: string;
  raw: string;
  markup: string;
  html: string;
}

interface CommitLinks {
  self: Link;
  html: Link;
  diff: Link;
  approve: Link;
  comments: Link;
  statuses: Link;
  patch: Link;
}

interface Link {
  href: string;
}

interface Parent {
  hash: string;
  links: ParentLinks;
  type: string;
}

interface ParentLinks {
  self: Link;
  html: Link;
}

interface RenderedMessage {
  message: Summary;
}

interface Repository {
  type: string;
  full_name: string;
  links: RepositoryLinks;
  name: string;
  uuid: string;
}

interface RepositoryLinks {
  self: Link;
  html: Link;
  avatar: Link;
}
