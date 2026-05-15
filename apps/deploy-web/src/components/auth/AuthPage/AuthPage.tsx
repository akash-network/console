"use client";

import { useFlag } from "@src/hooks/useFlag";
import { AuthPageLegacy } from "../AuthPageLegacy/AuthPageLegacy";
import { AuthPagePasswordlessClient } from "../AuthPagePasswordless/AuthPagePasswordless";

export const DEPENDENCIES = {
  AuthPageLegacy,
  AuthPagePasswordless: AuthPagePasswordlessClient,
  useFlag
};

interface Props {
  dependencies?: typeof DEPENDENCIES;
}

export function AuthPage({ dependencies: d = DEPENDENCIES }: Props = {}) {
  const isRedesignEnabled = d.useFlag("console_auth_redesign");
  return isRedesignEnabled ? <d.AuthPagePasswordless /> : <d.AuthPageLegacy />;
}
