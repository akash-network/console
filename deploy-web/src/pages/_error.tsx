import Layout from "../components/layout/Layout";
import { PageContainer } from "@src/components/shared/PageContainer";
import { Title } from "@src/components/shared/Title";
import { NextSeo } from "next-seo";
import { UrlService } from "@src/utils/urlUtils";
import Link from "next/link";
import { NextPage, NextPageContext } from "next";
import * as Sentry from "@sentry/nextjs";
import { buttonVariants } from "@src/components/ui/button";
import { cn } from "@src/utils/styleUtils";
import { NavArrowRight } from "iconoir-react";

type Props = {
  statusCode: number;
};

const Error: NextPage<Props> = ({ statusCode }) => {
  return (
    <Layout>
      <NextSeo title="Error" />

      <PageContainer>
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
      </PageContainer>
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
