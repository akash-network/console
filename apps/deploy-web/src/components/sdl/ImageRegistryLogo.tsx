"use client";
import Image from "next/legacy/image";

type Props = {
  host?: 'docker.io' | 'ghcr.io';
};

const images = {
  'docker.io': {
    filename: 'docker',
    height: 18
  },
  'ghcr.io': {
    filename: 'github',
    height: 24
  }
};

export const ImageRegistryLogo: React.FunctionComponent<Props> = ({
  host = 'docker.io',
}) => {
  return (
    <Image alt="Docker Logo" src={`/images/${images[host].filename}.png`} layout="fixed" quality={100} width={24} height={images[host].height} priority />
  );
};
