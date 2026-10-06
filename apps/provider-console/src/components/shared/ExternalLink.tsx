"use client";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

type Props = {
  href: string;
  text: string;
};

export const ExternalLink: React.FunctionComponent<Props> = ({ href, text }) => {
  return (
    <Link href={href} passHref target="_blank" rel="noreferrer">
      <span className="inline-flex items-center space-x-2 whitespace-nowrap">
        <span>{text}</span>
        <ExternalLinkIcon className="h-4 w-4" />
      </span>
    </Link>
  );
};
