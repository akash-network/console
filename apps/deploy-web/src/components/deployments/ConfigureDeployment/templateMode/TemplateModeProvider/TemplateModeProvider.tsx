"use client";
import { createContext, type FC, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

import type { TemplateAskedValue } from "@src/types/marketplace-template";
import { guessAskedValue, labelFromKey } from "../askedValueDefaults";
import type { AskedValueSetting } from "../buildAskedValues";

export type AskedValueCustomization = AskedValueSetting["customized"];

export type AskedValueSettings = Record<string, AskedValueSetting>;

export type TemplateModeState = {
  settings: AskedValueSettings;
  setAsked: (key: string, isAsked: boolean) => void;
  customize: (key: string, patch: AskedValueCustomization) => void;
  isDirty: boolean;
  markSaved: () => void;
};

const TemplateModeContext = createContext<TemplateModeState | null>(null);

type Props = {
  initialAskedValues: TemplateAskedValue[];
  children: ReactNode;
};

export const TemplateModeProvider: FC<Props> = ({ initialAskedValues, children }) => {
  const [settings, setSettings] = useState(() => settingsFromAskedValues(initialAskedValues));
  const [isDirty, setDirty] = useState(false);

  const updateSetting = useCallback((key: string, update: (setting: AskedValueSetting) => AskedValueSetting) => {
    setSettings(current => withSetting(current, key, update(current[key] ?? { key, isAsked: false, customized: {} })));
    setDirty(true);
  }, []);

  const setAsked = useCallback((key: string, isAsked: boolean) => updateSetting(key, setting => ({ ...setting, isAsked })), [updateSetting]);

  const customize = useCallback(
    (key: string, patch: AskedValueCustomization) => updateSetting(key, setting => ({ ...setting, customized: { ...setting.customized, ...patch } })),
    [updateSetting]
  );

  const markSaved = useCallback(() => setDirty(false), []);

  const state = useMemo(() => ({ settings, setAsked, customize, isDirty, markSaved }), [settings, setAsked, customize, isDirty, markSaved]);

  return <TemplateModeContext.Provider value={state}>{children}</TemplateModeContext.Provider>;
};

export function useTemplateMode(): TemplateModeState | null {
  return useContext(TemplateModeContext);
}

/** Settings are keyed by env key, and `__proto__` is a valid one, so they live on a prototype-less object. */
function withSetting(settings: AskedValueSettings, key: string, setting: AskedValueSetting): AskedValueSettings {
  const next: AskedValueSettings = Object.assign(Object.create(null), settings);
  next[key] = setting;
  return next;
}

function settingsFromAskedValues(askedValues: TemplateAskedValue[]): AskedValueSettings {
  return askedValues.reduce<AskedValueSettings>(
    (settings, askedValue) => withSetting(settings, askedValue.key, { key: askedValue.key, isAsked: true, customized: customizationOf(askedValue) }),
    Object.create(null)
  );
}

function customizationOf(askedValue: TemplateAskedValue): AskedValueCustomization {
  const defaultValue = askedValue.type === "secret" ? undefined : askedValue.default;
  const guess = guessAskedValue({ value: defaultValue ?? "", isSecret: askedValue.type === "secret" });

  return withoutUndefined({
    label: askedValue.label === labelFromKey(askedValue.key) ? undefined : askedValue.label,
    help: askedValue.help,
    type: askedValue.type === guess.type ? undefined : askedValue.type,
    required: askedValue.required === guess.required ? undefined : askedValue.required,
    ...typeSpecificCustomization(askedValue, guess.type === "number" && guess.integer)
  });
}

function typeSpecificCustomization(askedValue: TemplateAskedValue, isGuessedInteger: boolean): AskedValueCustomization {
  switch (askedValue.type) {
    case "number": {
      const integer = askedValue.integer ?? false;
      return { min: askedValue.min, max: askedValue.max, integer: integer === isGuessedInteger ? undefined : integer };
    }
    case "text":
      return { minLength: askedValue.minLength, maxLength: askedValue.maxLength };
    case "choice":
      return { choices: askedValue.choices };
    default:
      return {};
  }
}

function withoutUndefined<T extends Record<string, unknown>>(fields: T): T {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as T;
}
