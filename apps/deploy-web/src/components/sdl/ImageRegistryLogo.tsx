"use client";
import Image from "next/legacy/image";

type Props = {
  host?: string;
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

export const ImageRegistryLogo: React.FunctionComponent<Props> = ({ host }) => {
  const imageConfig = host ? images[host] : images["docker.io"];

  if (!imageConfig) {
    return null;
  }

  return <Image alt="Registry Logo" src={`/images/${imageConfig.filename}.png`} layout="fixed" quality={100} width={24} height={imageConfig.height} priority />;
};
