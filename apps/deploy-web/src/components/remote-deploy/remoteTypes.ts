export interface IGithubDirectoryItem {
  type: "file" | "dir" | "commit_directory" | "tree";
  size: number;
  name: string;
  path: string;
  content?: string;
  sha: string;
  url: string;
  git_url: string;
  html_url: string;
  download_url: string;
  _links: {
    git: string;
    html: string;
    self: string;
  };
}
