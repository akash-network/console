import type { TemplateCategory } from "@src/types/marketplace-template";

const CATEGORIES: Record<TemplateCategory, true> = {
  "AI - CPU": true,
  "AI - GPU": true,
  Benchmarking: true,
  Blockchain: true,
  Blogging: true,
  "Built with Cosmos-SDK": true,
  Business: true,
  "CI/CD, DevOps": true,
  Chat: true,
  "Data Visualization": true,
  "Databases and Administration": true,
  DeFi: true,
  "Decentralized Storage": true,
  "Game Servers": true,
  Games: true,
  Hosting: true,
  "Machine Learning": true,
  "Mining - CPU": true,
  "Mining - GPU": true,
  "Mining Pools": true,
  Network: true,
  Official: true,
  "Peer-to-peer File Sharing": true,
  "Project Management": true,
  "Search Engines": true,
  Social: true,
  Tools: true,
  "Video Conferencing": true,
  Wallet: true,
  "Web Frameworks": true
};

export const TEMPLATE_CATEGORY_OPTIONS = Object.keys(CATEGORIES) as TemplateCategory[];

export const MAX_TEMPLATE_CATEGORIES = 3;
