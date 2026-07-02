"use client";
import { type FC, useCallback, useId, useMemo, useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  Button,
  CheckboxWithLabel,
  CollapsibleCard,
  DialogV2,
  DialogV2Body,
  DialogV2Content,
  DialogV2Description,
  DialogV2Footer,
  DialogV2Header,
  DialogV2Title,
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ToggleGroup,
  ToggleGroupItem
} from "@akashnetwork/ui/components";
import { ChevronRightIcon, GlobeIcon, PlusIcon, SaveIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";

import type { ExposeType, SdlBuilderFormValuesType } from "@src/types";
import { defaultHttpOptions, nextCases as nextCaseOptions, protoTypes } from "@src/utils/sdl/data";
import { exposePortsTooltip } from "../cardTooltips";

export const DEPENDENCIES = { CollapsibleCard, DialogV2, DialogV2Content, DialogV2Header, DialogV2Title, DialogV2Description, DialogV2Body, DialogV2Footer };

type Props = {
  serviceIndex: number;
  /** While the pane is locked the dialog still opens for viewing but its inputs and Save are disabled. */
  locked?: boolean;
  dependencies?: typeof DEPENDENCIES;
};

/** Routing values stored as the `global`/`ipName` pair on the model. */
export const PUBLIC_ROUTING = "public" as const;
export const INTERNAL_ROUTING = "internal" as const;

/** The `global`/`ipName` subset of an expose entry that routing derives from and writes back. */
export type RoutingModel = Pick<ExposeType, "global" | "ipName">;

/**
 * Collapses the model's `global`/`ipName` pair into the single routing value the
 * dropdown shows: a non-empty `ipName` selects that IP endpoint, otherwise the
 * port is "public" when global and "internal" when not.
 */
export const routingValueOf = ({ global, ipName }: RoutingModel): string => {
  if (ipName) return ipName;
  return global ? PUBLIC_ROUTING : INTERNAL_ROUTING;
};

/**
 * Maps a routing dropdown value back onto the model's `global`/`ipName` pair:
 * "public" is globally reachable with no IP name, "internal" is neither, and any
 * other value binds the port to that named (publicly routable) IP endpoint.
 */
export const routingToModel = (value: string): RoutingModel => {
  if (value === PUBLIC_ROUTING) return { global: true, ipName: "" };
  if (value === INTERNAL_ROUTING) return { global: false, ipName: "" };
  return { global: true, ipName: value };
};

/** Serializes the accept-hostname list into the comma-separated value the input shows. */
export const hostnamesToInput = (accept: ExposeType["accept"]): string => (accept ?? []).map(entry => entry.value).join(", ");

/** Parses the comma-separated hostnames input into the model's `accept` list, dropping blanks. */
export const inputToHostnames = (value: string): NonNullable<ExposeType["accept"]> =>
  value
    .split(",")
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => ({ id: nanoid(), value: token }));

/**
 * "Expose Ports" card. The card is non-collapsible: clicking its header opens a
 * Dialog where the user maps container ports to externally reachable ports on the
 * shared deployment model (`services.${serviceIndex}.expose`). Each row edits a
 * port mapping — container port, exposed-as port, protocol (the SDL supports
 * http/tcp), routing and accepted hostnames.
 *
 * Routing is a derived control over the model's `global`/`ipName` pair: "Public"
 * is `global: true` with no IP name, "Internal" is `global: false`, and each
 * declared IP endpoint is `global: true` bound to that endpoint's name. Accepted
 * hostnames (the `accept` array) and the custom `httpOptions` are HTTP-only: they
 * surface only while the protocol is `http` (and `accept` only when not internal),
 * and switching a port to `tcp` clears their backing values so the SDL never carries
 * HTTP-only config onto a non-HTTP expose.
 *
 * Changes are committed on Save and reverted on Cancel. The header shows the count
 * of mapped ports.
 */
export const ExposePortsCard: FC<Props> = ({ serviceIndex, locked = false, dependencies: d = DEPENDENCIES }) => {
  const { control, getValues, reset, trigger, formState } = useFormContext<SdlBuilderFormValuesType>();
  const expose = useWatch({ control, name: `services.${serviceIndex}.expose` });
  const portCount = (expose ?? []).length;
  const { isSubmitted } = formState;
  /**
   * Expose errors live on per-port fields inside the (closed) modal, so surface them on the card
   * itself. Both this and the card's own Save/Cancel re-validation are deferred until after the first
   * submit (`isSubmitted`), matching the form's `onSubmit` mode — otherwise closing the modal would
   * light up the card and its fields before the user ever submits.
   */
  const hasErrors = isSubmitted && !!formState.errors.services?.[serviceIndex]?.expose;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<SdlBuilderFormValuesType | null>(null);

  const openModal = useCallback(() => {
    setSnapshot(structuredClone(getValues()));
    setOpen(true);
  }, [getValues]);

  const handleCancel = useCallback(() => {
    if (snapshot) {
      reset(snapshot, { keepErrors: true });
      if (isSubmitted) void trigger(`services.${serviceIndex}.expose`);
    }
    setOpen(false);
  }, [reset, trigger, snapshot, serviceIndex, isSubmitted]);

  const handleSave = useCallback(() => {
    reset(getValues(), { keepDirty: true, keepErrors: true });
    if (isSubmitted) void trigger(`services.${serviceIndex}.expose`);
    setOpen(false);
  }, [getValues, reset, trigger, serviceIndex, isSubmitted]);

  return (
    <>
      <d.CollapsibleCard
        title="Expose Ports"
        icon={<GlobeIcon className="h-4 w-4" />}
        infoTooltip={exposePortsTooltip}
        className={hasErrors ? "border-destructive dark:border-destructive" : undefined}
        summary={
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">{portCount}</span>
            <ChevronRightIcon className="size-4" />
          </div>
        }
        onHeaderClick={openModal}
      />

      <d.DialogV2
        open={open}
        onOpenChange={isOpen => {
          if (!isOpen) handleCancel();
        }}
      >
        <d.DialogV2Content className="max-w-lg" aria-describedby="expose-ports-description">
          <d.DialogV2Header>
            <d.DialogV2Title>Exposed ports</d.DialogV2Title>
            <d.DialogV2Description id="expose-ports-description">
              Map container ports to external ports. TCP/HTTP. Add as many as you need before saving.
            </d.DialogV2Description>
          </d.DialogV2Header>

          <d.DialogV2Body>
            <fieldset disabled={locked} className="contents">
              <ExposePortsList serviceIndex={serviceIndex} />
            </fieldset>
          </d.DialogV2Body>

          <d.DialogV2Footer className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {portCount} port{portCount === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={locked}>
                Save
                <SaveIcon className="ml-2 size-4" />
              </Button>
            </div>
          </d.DialogV2Footer>
        </d.DialogV2Content>
      </d.DialogV2>
    </>
  );
};

/** A fresh port mapping seeded with the single-port HTTP defaults. */
const newExpose = (): Partial<ExposeType> => ({ id: nanoid(), port: 80, as: 80, proto: "http", global: true, to: [], accept: [], ipName: "" });

/** Parses a numeric input value, returning `undefined` for blank/non-numeric input so the field can show empty. */
const parsePort = (value: string): number | undefined => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

/**
 * Returns focus to the Select trigger when a nested dropdown closes so the dialog's
 * focus scope keeps ownership; without it the nested Radix focus scopes can fight
 * over focus restoration when the dropdown closes inside the modal.
 */
const keepFocusInDialog = (event: Event) => event.preventDefault();

type ExposePortsListProps = {
  serviceIndex: number;
};

const ExposePortsList: FC<ExposePortsListProps> = ({ serviceIndex }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const { fields, append, remove } = useFieldArray({ control, name: `services.${serviceIndex}.expose`, keyName: "fieldId" });

  const add = useCallback(() => {
    append(newExpose() as ExposeType);
  }, [append]);

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field, exposeIndex) => (
        <ExposePortFields
          key={field.fieldId}
          serviceIndex={serviceIndex}
          exposeIndex={exposeIndex}
          onRemove={fields.length > 1 ? () => remove(exposeIndex) : undefined}
        />
      ))}

      <Button type="button" variant="outline" onClick={add} className="w-full border-dashed text-muted-foreground hover:text-foreground">
        <PlusIcon className="mr-2 size-4" />
        Add another port
      </Button>
    </div>
  );
};

type ExposePortFieldsProps = {
  serviceIndex: number;
  exposeIndex: number;
  onRemove?: () => void;
};

const ExposePortFields: FC<ExposePortFieldsProps> = ({ serviceIndex, exposeIndex, onRemove }) => {
  const { control, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.expose.${exposeIndex}` as const;
  const endpoints = useWatch({ control, name: "endpoints" }) ?? [];
  const watchedServices = useWatch({ control, name: "services" });
  const services = useMemo(() => watchedServices ?? [], [watchedServices]);
  const fieldId = useId();

  const port = useController({ control, name: `${basePath}.port` });
  const as = useController({ control, name: `${basePath}.as` });
  const proto = useController({ control, name: `${basePath}.proto` });
  const global = useController({ control, name: `${basePath}.global` });
  const ipName = useController({ control, name: `${basePath}.ipName` });
  const accept = useController({ control, name: `${basePath}.accept` });
  const to = useController({ control, name: `${basePath}.to` });

  const routingValue = useMemo(() => routingValueOf({ global: global.field.value, ipName: ipName.field.value }), [global.field.value, ipName.field.value]);

  const isInternal = routingValue === INTERNAL_ROUTING;
  const isHttp = (proto.field.value ?? "http") === "http";

  const currentService = services[serviceIndex];
  const otherServices = useMemo(
    () => (services as SdlBuilderFormValuesType["services"]).filter(service => service.id !== currentService?.id),
    [services, currentService?.id]
  );

  const selectedTargets = useMemo(() => new Set((to.field.value ?? []).map(entry => entry.value)), [to.field.value]);

  const toggleTarget = useCallback(
    (title: string, checked: boolean) => {
      const next = (to.field.value ?? []).filter(entry => entry.value !== title);
      if (checked) next.push({ id: nanoid(), value: title });
      to.field.onChange(next);
    },
    [to.field]
  );

  const changeRouting = useCallback(
    (value: string) => {
      const next = routingToModel(value);
      global.field.onChange(next.global);
      ipName.field.onChange(next.ipName);
    },
    [global.field, ipName.field]
  );

  const hostnamesValue = useMemo(() => hostnamesToInput(accept.field.value), [accept.field.value]);

  const changeHostnames = useCallback(
    (value: string) => {
      accept.field.onChange(inputToHostnames(value));
    },
    [accept.field]
  );

  /**
   * `accept` hostnames and `httpOptions` are HTTP-only — switching a port to a non-HTTP
   * protocol hides those controls, so clear their backing values too (and reset the custom
   * HTTP options toggle) to keep the model from carrying HTTP-only config onto a TCP expose.
   */
  const changeProto = useCallback(
    (value: string) => {
      if (!value) return;
      proto.field.onChange(value);
      if (value !== "http") {
        accept.field.onChange([]);
        setValue(`${basePath}.hasCustomHttpOptions`, false, { shouldDirty: true });
        setValue(`${basePath}.httpOptions`, undefined, { shouldDirty: true });
      }
    },
    [proto.field, accept.field, setValue, basePath]
  );

  return (
    <div role="group" aria-label={`Port ${exposeIndex + 1}`} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-start gap-2">
        <Field className="flex-1 gap-2">
          <FieldLabel htmlFor={`${fieldId}-port`}>Container port</FieldLabel>
          <FieldContent>
            <Input
              id={`${fieldId}-port`}
              aria-label={`Port ${exposeIndex + 1} container port`}
              type="number"
              min={1}
              max={65535}
              value={port.field.value ?? ""}
              onChange={event => port.field.onChange(parsePort(event.target.value))}
              onBlur={port.field.onBlur}
              error={!!port.fieldState.error}
              inputClassName="h-9"
            />
            <FieldError>{port.fieldState.error?.message}</FieldError>
          </FieldContent>
        </Field>

        <Field className="flex-1 gap-2">
          <FieldLabel htmlFor={`${fieldId}-as`}>Exposed as</FieldLabel>
          <FieldContent>
            <Input
              id={`${fieldId}-as`}
              aria-label={`Port ${exposeIndex + 1} exposed as`}
              type="number"
              min={1}
              max={65535}
              value={as.field.value ?? ""}
              onChange={event => as.field.onChange(parsePort(event.target.value))}
              onBlur={as.field.onBlur}
              error={!!as.fieldState.error}
              inputClassName="h-9"
            />
            <FieldError>{as.fieldState.error?.message}</FieldError>
          </FieldContent>
        </Field>

        {onRemove && (
          <Button size="icon" type="button" variant="ghost" className="mt-6 h-9 w-9 shrink-0" aria-label={`Remove port ${exposeIndex + 1}`} onClick={onRemove}>
            <XIcon className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-start gap-2">
        <Field className="flex-1 gap-2">
          <FieldLabel>Protocol</FieldLabel>
          <FieldContent>
            <ToggleGroup
              type="single"
              variant="outline"
              value={proto.field.value ?? "http"}
              onValueChange={changeProto}
              className="h-9 justify-start gap-0 rounded-md border"
              aria-label={`Port ${exposeIndex + 1} protocol`}
            >
              {protoTypes.map(option => (
                <ToggleGroupItem
                  key={option.id}
                  value={option.name}
                  aria-label={option.name}
                  className="h-full flex-1 rounded-none border-0 uppercase first:rounded-l-md last:rounded-r-md"
                >
                  {option.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </FieldContent>
        </Field>

        <Field className="flex-1 gap-2">
          <FieldLabel>Routing</FieldLabel>
          <FieldContent>
            <Select value={routingValue} onValueChange={changeRouting}>
              <SelectTrigger aria-label={`Port ${exposeIndex + 1} routing`} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent onCloseAutoFocus={keepFocusInDialog}>
                <SelectItem value={PUBLIC_ROUTING}>Public (any IP)</SelectItem>
                <SelectItem value={INTERNAL_ROUTING}>Internal</SelectItem>
                {endpoints.map(endpoint => (
                  <SelectItem key={endpoint.id} value={endpoint.name}>
                    IP endpoint: {endpoint.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
      </div>

      {isHttp && !isInternal && (
        <Field className="gap-2">
          <FieldLabel htmlFor={`${fieldId}-hostnames`}>Accept hostnames</FieldLabel>
          <FieldContent>
            <Input
              id={`${fieldId}-hostnames`}
              aria-label={`Port ${exposeIndex + 1} accept hostnames`}
              placeholder="example.com, api.example.com"
              defaultValue={hostnamesValue}
              onChange={event => changeHostnames(event.target.value)}
              inputClassName="h-9"
            />
          </FieldContent>
        </Field>
      )}

      {otherServices.length > 0 && (
        <Field className="gap-2">
          <FieldLabel>To</FieldLabel>
          <FieldContent>
            <div role="group" aria-label={`Port ${exposeIndex + 1} to targets`} className="flex flex-col gap-2">
              {otherServices.map(service => (
                <CheckboxWithLabel
                  key={service.id}
                  checked={selectedTargets.has(service.title)}
                  onCheckedChange={state => toggleTarget(service.title, state === "indeterminate" ? false : state)}
                  label={service.title}
                />
              ))}
            </div>
          </FieldContent>
        </Field>
      )}

      {isHttp && (
        <>
          <Separator className="my-2" />

          <HttpOptionsFields serviceIndex={serviceIndex} exposeIndex={exposeIndex} />
        </>
      )}
    </div>
  );
};

type HttpOptionsFieldsProps = {
  serviceIndex: number;
  exposeIndex: number;
};

/** Numeric HTTP option fields rendered when custom options are enabled, with their seeded default. */
const HTTP_OPTION_FIELDS = [
  { key: "maxBodySize", label: "Max body size", default: defaultHttpOptions.maxBodySize },
  { key: "readTimeout", label: "Read timeout", default: defaultHttpOptions.readTimeout },
  { key: "sendTimeout", label: "Send timeout", default: defaultHttpOptions.sendTimeout },
  { key: "nextTries", label: "Next tries", default: defaultHttpOptions.nextTries },
  { key: "nextTimeout", label: "Next timeout", default: defaultHttpOptions.nextTimeout }
] as const;

/** The full `httpOptions` object the schema requires, seeded from the shared defaults. */
const fullHttpOptions = (): NonNullable<ExposeType["httpOptions"]> => ({
  maxBodySize: defaultHttpOptions.maxBodySize,
  readTimeout: defaultHttpOptions.readTimeout,
  sendTimeout: defaultHttpOptions.sendTimeout,
  nextTries: defaultHttpOptions.nextTries,
  nextTimeout: defaultHttpOptions.nextTimeout,
  nextCases: [...defaultHttpOptions.nextCases]
});

/**
 * Per-port HTTP options. A checkbox toggles `hasCustomHttpOptions`; while on, the
 * SDL `http_options` block is emitted with the values below (max body size, the
 * proxy timeouts/retries and the retry "next cases").
 *
 * `httpOptions` must be present in full or absent entirely — the schema marks the
 * whole object optional but requires all six fields once it exists. So enabling
 * seeds the complete default object (unless the port already carries one) and the
 * `nextCases`/numeric controllers mount only while enabled; writing only some of
 * them would leave the port silently invalid.
 */
const HttpOptionsFields: FC<HttpOptionsFieldsProps> = ({ serviceIndex, exposeIndex }) => {
  const { control, getValues, setValue } = useFormContext<SdlBuilderFormValuesType>();
  const basePath = `services.${serviceIndex}.expose.${exposeIndex}` as const;
  const hasCustomHttpOptions = useController({ control, name: `${basePath}.hasCustomHttpOptions` });

  const toggleCustomOptions = useCallback(
    (checked: boolean) => {
      if (checked) {
        if (!getValues(`${basePath}.httpOptions`)) {
          setValue(`${basePath}.httpOptions`, fullHttpOptions(), { shouldDirty: true });
        }
      } else {
        setValue(`${basePath}.httpOptions`, undefined, { shouldDirty: true });
      }
      hasCustomHttpOptions.field.onChange(checked);
    },
    [hasCustomHttpOptions.field, getValues, setValue, basePath]
  );

  return (
    <div className="flex flex-col gap-3">
      <CheckboxWithLabel
        checked={!!hasCustomHttpOptions.field.value}
        onCheckedChange={state => toggleCustomOptions(state === "indeterminate" ? false : state)}
        label="Custom HTTP options"
      />

      {hasCustomHttpOptions.field.value && (
        <div
          role="group"
          aria-label={`Port ${exposeIndex + 1} HTTP options`}
          className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
        >
          {HTTP_OPTION_FIELDS.map(option => (
            <HttpOptionNumberField key={option.key} basePath={basePath} optionKey={option.key} label={option.label} defaultValue={option.default} />
          ))}

          <NextCasesField basePath={basePath} />
        </div>
      )}
    </div>
  );
};

type NextCasesFieldProps = {
  basePath: `services.${number}.expose.${number}`;
};

/** Retry "next cases" checkbox group, mounted only while custom HTTP options are enabled. */
const NextCasesField: FC<NextCasesFieldProps> = ({ basePath }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const nextCasesField = useController({ control, name: `${basePath}.httpOptions.nextCases`, defaultValue: [...defaultHttpOptions.nextCases] });

  const selectedCases = new Set(nextCasesField.field.value ?? []);
  const toggleCase = useCallback(
    (value: string, checked: boolean) => {
      const next = (nextCasesField.field.value ?? []).filter(entry => entry !== value);
      if (checked) next.push(value);
      nextCasesField.field.onChange(next);
    },
    [nextCasesField.field]
  );

  return (
    <Field className="gap-2">
      <FieldLabel>Next cases</FieldLabel>
      <FieldContent>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {nextCaseOptions.map(option => (
            <CheckboxWithLabel
              key={option.value}
              checked={selectedCases.has(option.value)}
              onCheckedChange={state => toggleCase(option.value, state === "indeterminate" ? false : state)}
              label={option.label}
            />
          ))}
        </div>
      </FieldContent>
    </Field>
  );
};

type HttpOptionNumberFieldProps = {
  basePath: `services.${number}.expose.${number}`;
  optionKey: (typeof HTTP_OPTION_FIELDS)[number]["key"];
  label: string;
  defaultValue: number;
};

const HttpOptionNumberField: FC<HttpOptionNumberFieldProps> = ({ basePath, optionKey, label, defaultValue }) => {
  const { control } = useFormContext<SdlBuilderFormValuesType>();
  const field = useController({ control, name: `${basePath}.httpOptions.${optionKey}`, defaultValue });
  const id = useId();

  return (
    <Field className="gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FieldContent>
        <Input
          id={id}
          aria-label={label}
          type="number"
          min={0}
          value={field.field.value ?? ""}
          onChange={event => field.field.onChange(parsePort(event.target.value))}
          error={!!field.fieldState.error}
          inputClassName="h-9"
        />
        <FieldError>{field.fieldState.error?.message}</FieldError>
      </FieldContent>
    </Field>
  );
};
