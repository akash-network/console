export type ApiTemplate = {
  deploy?: string;
  githubUrl?: string;
  guide?: string;
  id?: string;
  logoUrl?: string;
  name?: string;
  path?: string;
  persistentStorageEnabled?: boolean;
  readme?: string;
  summary?: string;
  valuesToChange?: Array<any>;
  config?: {
    ssh?: boolean;
  };
};

export type TemplateCreation = {
  title: string;
  name?: string;
  code: string;
  category: string;
  description: string;
  githubUrl?: string;
  valuesToChange?: any[];
  content: string;
};

type TemplateSource = {
  name: string;
  path: string;
  repoOwner: string;
  repoName: string;
  repoVersion: string;
  summary?: string;
  logoUrl?: string;
};

export type ApiTemplateCategory = {
  title: string;
  description?: string;
  templateSources: TemplateSource[];
  templates: ApiTemplate[];
};

export type ITemplate = {
  id: string;
  userId: string;
  username: string;
  title: string;
  description: string;
  isPublic: boolean;
  cpu: number;
  ram: number;
  storage: number;
  sdl: string;
  isFavorite: boolean;
};
