import React from "react";
import { buttonVariants } from "@akashnetwork/ui/components";
import { ArrowLeft } from "iconoir-react";
import Link from "next/link";
import { NextSeo } from "next-seo";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";

const FiveHundred: React.FunctionComponent = () => {
  return (
    <Layout>
      <NextSeo title="Error" />
      <div className="mt-10 text-center">
        <Title className="mb-2">500</Title>
        <h3 className="text-2xl">An error has occured.</h3>

        <div className="pt-6">
          <Link href={UrlService.home()} className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")}>
            <ArrowLeft className="mr-4" />
            Go to homepage
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default FiveHundred;
