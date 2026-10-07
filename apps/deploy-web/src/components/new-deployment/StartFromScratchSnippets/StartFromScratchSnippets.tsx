"use client";
import type { FC } from "react";
import { useEffect, useState } from "react";

import type { SSH_VM_IMAGES } from "@src/utils/sdl/vmImages";

const TOKEN_CLASSES = {
  key: "text-muted-foreground",
  value: "font-medium text-foreground",
  dim: "text-muted-foreground opacity-70",
  prompt: "font-semibold text-emerald-600 dark:text-emerald-400"
};

const WELCOME_BANNERS: string[] = Object.values({
  "Ubuntu 24.04": "Welcome to Ubuntu 24.04 LTS",
  "CentOS Stream 9": "CentOS Stream release 9",
  "Debian 11": "Debian GNU/Linux 11 (bullseye)",
  "SuSE Leap 15.5": "openSUSE Leap 15.5"
} satisfies Record<keyof typeof SSH_VM_IMAGES, string>);

export const WELCOME_BANNER_ROTATION_MS = 2600;

export const ContainerSdlSnippet: FC = () => (
  <>
    <span className="block">
      <span className={TOKEN_CLASSES.key}>services:</span>
    </span>
    <span className="block">
      {"  "}
      <span className={TOKEN_CLASSES.key}>web:</span>
    </span>
    <span className="block">
      {"    "}
      <span className={TOKEN_CLASSES.key}>image:</span> <span className={TOKEN_CLASSES.value}>ghcr.io/you/app:latest</span>
    </span>
    <span className="block">
      {"    "}
      <span className={TOKEN_CLASSES.key}>expose:</span> <span className={TOKEN_CLASSES.value}>8080</span> <span className={TOKEN_CLASSES.dim}>→</span>{" "}
      <span className={TOKEN_CLASSES.value}>80</span>
    </span>
  </>
);

export const SshSessionSnippet: FC = () => {
  const [bannerIndex, setBannerIndex] = useState(0);

  useEffect(function rotateWelcomeBanner() {
    const interval = setInterval(() => setBannerIndex(index => (index + 1) % WELCOME_BANNERS.length), WELCOME_BANNER_ROTATION_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <span className="block">
        <span className={TOKEN_CLASSES.prompt}>$</span> <span className={TOKEN_CLASSES.value}>ssh root@your-machine -p 32022</span>
      </span>
      <span
        key={bannerIndex}
        className="block text-muted-foreground duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
      >
        {WELCOME_BANNERS[bannerIndex]}
      </span>
      <span className="block">
        <span className={TOKEN_CLASSES.prompt}>root@akash</span>
        <span className={TOKEN_CLASSES.key}>:~# </span>
        <span className="inline-block h-3.5 w-[7px] bg-foreground align-[-2px] motion-safe:animate-terminal-cursor-blink" />
      </span>
    </>
  );
};
