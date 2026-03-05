"use client";
import Image from "next/legacy/image";

const DEPENDENCIES = {
  Image
};

type Props = {
  host?: string;
  dependencies?: typeof DEPENDENCIES;
};

const images: Record<string, { filename: string; height: number }> = {
  "docker.io": {
    filename: "docker",
    height: 18
  },
  "ghcr.io": {
    filename: "github",
    height: 24
  },
  "registry.gitlab.com": {
    filename: "gitlab",
    height: 24
  }
};

export const ImageRegistryLogo: React.FunctionComponent<Props> = ({ host, dependencies: d = DEPENDENCIES }) => {
  const imageConfig = images[host!] || images["docker.io"];

  return (
    <d.Image alt="Registry Logo" src={`/images/${imageConfig.filename}.png`} layout="fixed" quality={100} width={24} height={imageConfig.height} priority />
  );
};
