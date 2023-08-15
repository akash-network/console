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
