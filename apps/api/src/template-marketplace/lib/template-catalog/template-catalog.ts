export const TEMPLATE_ICONS = [
  "box",
  "bot",
  "brain",
  "message-square",
  "image",
  "video",
  "music",
  "database",
  "server",
  "globe",
  "code",
  "terminal",
  "gamepad",
  "chart",
  "shield",
  "workflow",
  "cpu",
  "layers",
  "file-text",
  "search",
  "mail",
  "cloud",
  "wallet",
  "rocket"
] as const;

export type TemplateIcon = (typeof TEMPLATE_ICONS)[number];

export const TEMPLATE_CATEGORIES = [
  "AI - CPU",
  "AI - GPU",
  "Benchmarking",
  "Blockchain",
  "Blogging",
  "Built with Cosmos-SDK",
  "Business",
  "CI/CD, DevOps",
  "Chat",
  "Data Visualization",
  "Databases and Administration",
  "DeFi",
  "Decentralized Storage",
  "Game Servers",
  "Games",
  "Hosting",
  "Machine Learning",
  "Mining - CPU",
  "Mining - GPU",
  "Mining Pools",
  "Network",
  "Official",
  "Peer-to-peer File Sharing",
  "Project Management",
  "Search Engines",
  "Social",
  "Tools",
  "Video Conferencing",
  "Wallet",
  "Web Frameworks"
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const MAX_TEMPLATE_CATEGORIES = 3;
export const MAX_TEMPLATE_TITLE_LENGTH = 80;
export const MAX_TEMPLATE_SUMMARY_LENGTH = 200;
export const MAX_TEMPLATE_README_LENGTH = 50_000;
