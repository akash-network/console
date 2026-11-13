import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Box,
  Brain,
  ChartLine,
  Cloud,
  Code,
  Cpu,
  Database,
  FileText,
  Gamepad2,
  Globe,
  Image,
  Layers,
  Mail,
  MessageSquare,
  Music,
  Rocket,
  Search,
  Server,
  Shield,
  Terminal,
  Video,
  Wallet,
  Workflow
} from "lucide-react";

import type { TemplateIconId } from "@src/types/marketplace-template";

export const TEMPLATE_ICONS: Record<TemplateIconId, LucideIcon> = {
  box: Box,
  bot: Bot,
  brain: Brain,
  "message-square": MessageSquare,
  image: Image,
  video: Video,
  music: Music,
  database: Database,
  server: Server,
  globe: Globe,
  code: Code,
  terminal: Terminal,
  gamepad: Gamepad2,
  chart: ChartLine,
  shield: Shield,
  workflow: Workflow,
  cpu: Cpu,
  layers: Layers,
  "file-text": FileText,
  search: Search,
  mail: Mail,
  cloud: Cloud,
  wallet: Wallet,
  rocket: Rocket
};

export const TemplateIcon: FC<{ icon: string | null; className?: string }> = ({ icon, className }) => {
  const Icon = icon && Object.hasOwn(TEMPLATE_ICONS, icon) ? TEMPLATE_ICONS[icon as TemplateIconId] : Box;
  return <Icon className={className} aria-hidden="true" />;
};
