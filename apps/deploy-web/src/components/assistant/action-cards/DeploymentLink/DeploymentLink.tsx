"use client";
import type { FC } from "react";
import Link from "next/link";

import { UrlService } from "@src/utils/urlUtils";

type Props = { dseq: string; name: string | null };

export const DeploymentLink: FC<Props> = ({ dseq, name }) => (
  <Link href={UrlService.deploymentDetails(dseq)} className="font-sans underline underline-offset-[3px]">
    {name || "View deployment"}
  </Link>
);
