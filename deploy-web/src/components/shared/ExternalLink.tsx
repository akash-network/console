"use client";
import { OpenNewWindow } from "iconoir-react";
import Link from "next/link";

type Props = {
  href: string;
  text: string;
};

export const ExternalLink: React.FunctionComponent<Props> = ({ href, text }) => {
  return (
    <Link href={href} passHref target="_blank" rel="noreferrer">
      <span className="inline-flex items-center whitespace-nowrap">
        {text}
        <OpenNewWindow className="ml-1 text-sm" />
      </span>
    </Link>
  );
};
