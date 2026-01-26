export type TemplateSource = {
  name: string;
  path: string;
  repoOwner: string;
  repoName: string;
  repoVersion: string;
  summary?: string;
  logoUrl?: string | null;
};

export type Category = {
  title: string;
  description?: string;
  templateSources: TemplateSource[];
  templates?: Template[];
};

export type FinalCategory = Omit<Category, "templateSources" | "templates"> & {
  templates: Template[];
};

export type TemplateConfig = {
  ssh?: boolean;
  logoUrl?: string;
};

export type Template = {
  id: string;
  name: string;
  path: string;
  readme: string;
  summary: string;
  logoUrl: string;
  deploy: string;
  guide?: string;
  githubUrl: string;
  persistentStorageEnabled: boolean;
  config: TemplateConfig;
};
