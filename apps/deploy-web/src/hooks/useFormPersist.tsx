import { useEffect } from "react";
import type { SetFieldValue } from "react-hook-form";

export interface FormPersistConfig {
  storage?: Storage;
  watch: (names?: string | string[]) => any;
  setValue: SetFieldValue<any>;
  exclude?: string[];
  onDataRestored?: (data: any) => void;
  validate?: boolean;
  dirty?: boolean;
  touch?: boolean;
  onTimeout?: () => void;
  timeout?: number;
  defaultValues?: any;
  /**
   * Maps restored values before they are applied to the form — e.g. to migrate
   * drafts persisted with an older shape. Must be an idempotent, stable reference.
   */
  transform?: (values: Record<string, any>) => Record<string, any>;
}

const useFormPersist = (
  name: string,
  {
    storage,
    watch,
    setValue,
    exclude = [],
    onDataRestored,
    validate = false,
    dirty = false,
    touch = false,
    onTimeout,
    timeout,
    defaultValues,
    transform
  }: FormPersistConfig
) => {
  const watchedValues = watch();

  const getStorage = () => storage || window.sessionStorage;

  const clearStorage = () => getStorage().removeItem(name);

  useEffect(() => {
    const str = getStorage().getItem(name);
    let parsed = defaultValues;

    if (str) {
      try {
        parsed = JSON.parse(str);
      } catch {
        clearStorage();
        parsed = defaultValues;
      }
    }

    if (parsed) {
      const { _timestamp = null, ...restored } = parsed;
      const dataRestored: { [key: string]: any } = {};
      const currTimestamp = Date.now();

      if (timeout && currTimestamp - _timestamp > timeout) {
        if (onTimeout) onTimeout();
        clearStorage();
        return;
      }

      const values = transform ? transform(restored) : restored;

      Object.keys(values).forEach(key => {
        const shouldSet = !exclude.includes(key);
        if (shouldSet) {
          dataRestored[key] = values[key];
          setValue(key, values[key], {
            shouldValidate: validate,
            shouldDirty: dirty,
            shouldTouch: touch
          });
        }
      });

      if (onDataRestored) {
        onDataRestored(dataRestored);
      }
    }
  }, [storage, name, onDataRestored, setValue, defaultValues, transform]);

  useEffect(() => {
    const values = exclude.length
      ? Object.entries(watchedValues)
          .filter(([key]) => !exclude.includes(key))
          .reduce((obj, [key, val]) => Object.assign(obj, { [key]: val }), {})
      : Object.assign({}, watchedValues);

    if (Object.entries(values).length) {
      if (timeout !== undefined) {
        values._timestamp = Date.now();
      }
      getStorage().setItem(name, JSON.stringify(values));
    }
  }, [watchedValues, timeout]);

  return {
    clear: () => getStorage().removeItem(name)
  };
};

export default useFormPersist;
