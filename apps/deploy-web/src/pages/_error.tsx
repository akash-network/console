import * as Sentry from "@sentry/nextjs";
import { NavArrowRight } from "iconoir-react";
import { NextPage, NextPageContext } from "next";
import Link from "next/link";
import { NextSeo } from "next-seo";

import { Title } from "@src/components/shared/Title";
import { buttonVariants } from "@akashnetwork/ui/components";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";
import Layout from "../components/layout/Layout";

type Props = {
  statusCode: number;
};

const Error: NextPage<Props> = ({ statusCode }) => {
  return (
    <Layout>
      <NextSeo title="Error" />

      <div className="text-center">
        <h1>{statusCode}</h1>

        <Title>Error occured.</Title>

        <p>{statusCode ? `An error ${statusCode} occurred on server` : "An error occurred on client"}</p>

        <div className="pt-4">
          <Link className={cn(buttonVariants({ variant: "default" }), "inline-flex items-center")} href={UrlService.home()}>
            Go to homepage&nbsp;
            <NavArrowRight className="text-sm" />
          </Link>
        </div>
      </div>
    </Layout>
  );
};

Error.getInitialProps = async (context: NextPageContext) => {
  const { res, err } = context;
  const statusCode = res ? res.statusCode : err ? err.statusCode || 400 : 404;

  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(context);

  // This will contain the status code of the response
  // return Error.getInitialProps({ statusCode });
  return { statusCode };
};

export default Error;
