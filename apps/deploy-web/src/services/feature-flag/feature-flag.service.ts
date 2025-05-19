import { evaluateFlags, flagsClient, getDefinitions } from "@unleash/nextjs";
import type { GetServerSideProps } from "next";
import type { GetServerSidePropsContext } from "next/types";

import { serverEnvConfig } from "@src/config/server-env.config";

export const getFlag = async (name: string, sessionId?: string) => {
  if (serverEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL) {
    return true;
  }

  const definitions = await getDefinitions({
    fetchOptions: {
      next: { revalidate: 15 }
    }
  });

  const { toggles } = evaluateFlags(definitions, {
    sessionId
  });
  const flags = flagsClient(toggles);

  return flags.isEnabled(name);
};

const UNLEASH_COOKIE_KEY = "unleash-session-id=";

export const extractSessionId = ({ req }: GetServerSidePropsContext) => {
  const cookies = req.headers.cookie?.split(";").map(c => c.trim());
  const unleashCookie = cookies?.find(c => c.startsWith(UNLEASH_COOKIE_KEY));

  return unleashCookie?.replace(UNLEASH_COOKIE_KEY, "");
};

export const showIfEnabled =
  (name: string): GetServerSideProps =>
  async ctx => {
    if (serverEnvConfig.NEXT_PUBLIC_UNLEASH_ENABLE_ALL) {
      return {
        props: {}
      };
    }

    const sessionId = extractSessionId(ctx);
    const isEnabled = await getFlag(name, sessionId);

    if (!isEnabled) {
      return { notFound: true };
    }

    return {
      props: {}
    };
  };
