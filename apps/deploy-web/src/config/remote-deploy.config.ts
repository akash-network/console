import { browserEnvConfig } from "./browser-env.config";

export const CI_CD_TEMPLATE_ID = "akash-network-awesome-akash-automatic-deployment-CICD-template";
export const CURRENT_SERVICE = "services.0.env";
export const DEFAULT_ENV_IN_YML = "https://github.com/onwidget/astrowind";
export const ROOT_FOLDER_NAME = "akash-root-folder-repo-path";
export const protectedEnvironmentVariables = {
  REPO_URL: "REPO_URL",
  BRANCH_NAME: "BRANCH_NAME",
  accessToken: "accessToken",
  BUILD_DIRECTORY: "BUILD_DIRECTORY",
  BUILD_COMMAND: "BUILD_COMMAND",
  NODE_VERSION: "NODE_VERSION",
  CUSTOM_SRC: "CUSTOM_SRC",
  COMMIT_HASH: "COMMIT_HASH",
  GITLAB_PROJECT_ID: "GITLAB_PROJECT_ID",
  GITLAB_ACCESS_TOKEN: "GITLAB_ACCESS_TOKEN",
  BITBUCKET_ACCESS_TOKEN: "BITBUCKET_ACCESS_TOKEN",
  BITBUCKET_USER: "BITBUCKET_USER",
  DISABLE_PULL: "DISABLE_PULL",
  GITHUB_ACCESS_TOKEN: "GITHUB_ACCESS_TOKEN",
  FRONTEND_FOLDER: "FRONTEND_FOLDER",
  INSTALL_COMMAND: "INSTALL_COMMAND"
};

export const REDIRECT_URL = `${browserEnvConfig.NEXT_PUBLIC_REDIRECT_URI}?step=edit-deployment&type=github`;

export const supportedFrameworks = [
  {
    title: "React",
    value: "react",
    image: "https://static-00.iconduck.com/assets.00/react-icon-512x456-2ynx529a.png"
  },
  {
    title: "Vue",
    value: "vue",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Vue.js_Logo.svg/1200px-Vue.js_Logo.svg.png"
  },
  {
    title: "Angular",
    value: "angular",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Angular_full_color_logo.svg/1200px-Angular_full_color_logo.svg.png"
  },
  {
    title: "Svelte",
    value: "svelte",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Svelte_Logo.svg/1200px-Svelte_Logo.svg.png"
  },
  {
    title: "Next.js",
    value: "next",
    image: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/nextjs-icon.png"
  },

  {
    title: "Astro",
    value: "astro",
    image: "https://icon.icepanel.io/Technology/png-shadow-512/Astro.png"
  },
  {
    title: "Nuxt.js",
    value: "nuxt",
    image: "https://v2.nuxt.com/_nuxt/icons/icon_64x64.6dcbd4.png"
  },

  {
    title: "Gridsome ",
    value: "gridsome",
    image: "https://gridsome.org/assets/static/favicon.b9532cc.c6d52b979318cc0b0524324281174df2.png"
  },
  {
    title: "Vite",
    value: "vite",
    image: "https://vitejs.dev/logo.svg"
  },
  {
    title: "Other",
    value: "other"
  }
];
