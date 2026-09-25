"use client";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Alert, Button, Input, Switch } from "@akashnetwork/ui/components";

import { ImportSdlDialog } from "@src/components/deployments/ConfigureDeployment/SdlImportExport/ImportSdlDialog";
import type { DeploymentDto } from "@src/types/deployment";
import type { ImportableCredential, ImportableService } from "@src/utils/sdl/recordableDefinition";
import {
  importableServicesOf,
  recordableDefinitionOf,
  referenceNamesOf,
  secretVariableKey,
  suggestedSecretVariablesOf
} from "@src/utils/sdl/recordableDefinition";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import { useDefinitionImport } from "./useDefinitionImport";

export const DEPENDENCIES = { useDefinitionImport, ImportSdlDialog };

type CandidateOrigin = "browser" | "import";

interface Candidate {
  sdl: string;
  origin: CandidateOrigin;
}

const NOTHING_CHANGES_NOTE = "Saving doesn't change what's running.";
const INTRO_BY_ORIGIN: Record<CandidateOrigin | "none", string> = {
  browser:
    "The console doesn't hold this deployment's configuration yet, but this browser still has the copy it was created with. Save it to your account to update the deployment from any device.",
  import: "Check the configuration below, then save it to your account.",
  none: "The console doesn't hold this deployment's configuration, so it can't be updated here yet. Upload or paste the SDL it was created with to save it to your account."
};
const SECRETS_HINT = "Switch on the variables that hold secrets. Their values are encrypted and never shown again, while the rest stay readable.";
const MISSING_REFERENCES_HINT = "This SDL refers to secrets the console doesn't hold. Enter their values to save it.";
const CREDENTIAL_LABELS: Record<ImportableCredential["field"], string> = { username: "Registry username", password: "Registry password" };

export interface DefinitionImportProps {
  deployment: DeploymentDto;
  /** The copy of the deployment's sdl this browser still holds, if any. */
  browserSdl: string | undefined;
  onImported: () => void;
  dependencies?: typeof DEPENDENCIES;
}

/** Records a definition for a deployment the console holds none for, rewriting only the values it seals so the deployment keeps running as it is. */
export const DefinitionImport: FC<DefinitionImportProps> = ({ deployment, browserSdl, onImported, dependencies: d = DEPENDENCIES }) => {
  const [candidate, setCandidate] = useState<Candidate | null>(browserSdl ? { sdl: browserSdl, origin: "browser" } : null);
  const services = useMemo(() => (candidate ? importableServicesOf(candidate.sdl) : []), [candidate]);
  const [secretVariables, setSecretVariables] = useState<ReadonlySet<string>>(() => suggestedSecretVariablesOf(services));
  const [referenceValues, setReferenceValues] = useState<Record<string, string>>({});
  const [isChoosing, setIsChoosing] = useState(false);
  const { record, applyAsUpdate, clearRefusals, isSaving, mismatch, refusal } = d.useDefinitionImport({ dseq: deployment.dseq, onImported });
  const isClosed = deployment.state !== "active";
  const referenceNames = referenceNamesOf(services);
  const canSend = !isSaving && referenceNames.every(name => !!referenceValues[name]);

  function review(sdl: string) {
    clearRefusals();
    setCandidate({ sdl, origin: "import" });
    setSecretVariables(suggestedSecretVariablesOf(importableServicesOf(sdl)));
    setReferenceValues({});
    setIsChoosing(false);
  }

  function toggleSecret(key: string, isSecret: boolean) {
    clearRefusals();
    setSecretVariables(current => {
      const next = new Set(current);
      if (isSecret) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function enterReferenceValue(name: string, value: string) {
    clearRefusals();
    setReferenceValues(current => ({ ...current, [name]: value }));
  }

  function definitionOf(sdl: string) {
    return recordableDefinitionOf(sdl, { secretVariables, referenceValues });
  }

  return (
    <div className="flex flex-col gap-4">
      <DeploymentTabHeader title="Configuration" />

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-medium">Save this deployment's configuration</h3>
          <p className="text-sm text-muted-foreground">
            {INTRO_BY_ORIGIN[candidate?.origin ?? "none"]} {NOTHING_CHANGES_NOTE}
          </p>
        </div>

        {candidate ? (
          <>
            <p className="text-sm text-muted-foreground">{SECRETS_HINT}</p>
            {referenceNames.length > 0 && <p className="text-sm text-muted-foreground">{MISSING_REFERENCES_HINT}</p>}

            {services.map(service => (
              <ServiceReview
                key={service.name}
                service={service}
                secretVariables={secretVariables}
                referenceValues={referenceValues}
                locked={isSaving}
                onToggleSecret={toggleSecret}
                onReferenceValueChange={enterReferenceValue}
              />
            ))}

            {refusal && <Alert variant="destructive">{refusal}</Alert>}

            {mismatch && (
              <Alert variant="destructive" className="flex flex-col gap-3">
                <span>
                  {isClosed
                    ? "This SDL doesn't match what the deployment ran, so it wasn't saved. Choose the SDL the deployment was created with."
                    : "This SDL doesn't match what the deployment is running, so it wasn't saved. Choose the SDL the deployment was created with, or apply this one as an update, which restarts the workload with it."}
                </span>
                {!isClosed && (
                  <div>
                    <Button type="button" variant="outline" size="sm" disabled={!canSend} onClick={() => applyAsUpdate(definitionOf(candidate.sdl))}>
                      Apply as update
                    </Button>
                  </div>
                )}
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => setIsChoosing(true)}>
                Choose another SDL
              </Button>
              <Button type="button" disabled={!canSend} onClick={() => record(definitionOf(candidate.sdl))}>
                {isSaving ? "Saving…" : "Save to my account"}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button type="button" onClick={() => setIsChoosing(true)}>
              Upload or paste SDL
            </Button>
          </div>
        )}
      </div>

      {isChoosing && (
        <d.ImportSdlDialog
          title="Import this deployment's SDL"
          description="Paste the SDL this deployment was created with, or upload the file."
          onClose={() => setIsChoosing(false)}
          onImport={state => review(state.sdl)}
        />
      )}
    </div>
  );
};

interface ServiceReviewProps {
  service: ImportableService;
  secretVariables: ReadonlySet<string>;
  referenceValues: Record<string, string>;
  locked: boolean;
  onToggleSecret: (key: string, isSecret: boolean) => void;
  onReferenceValueChange: (name: string, value: string) => void;
}

/** Names only: a value typed into the sdl is never put back on screen, whether it ends up secret or not. */
const ServiceReview: FC<ServiceReviewProps> = ({ service, secretVariables, referenceValues, locked, onToggleSecret, onReferenceValueChange }) => (
  <section role="group" aria-label={`Service ${service.name}`} className="flex flex-col gap-3 rounded-lg border bg-background p-4">
    <div className="flex items-center gap-3">
      <span className="text-base font-medium">{service.name}</span>
      {service.image && <span className="truncate font-mono text-sm text-muted-foreground">{service.image}</span>}
    </div>

    {service.variables.length === 0 && <p className="text-sm text-muted-foreground">No variables.</p>}

    {service.variables.map(variable => {
      const key = secretVariableKey(service.name, variable.key);
      const { referenceName } = variable;
      return (
        <div key={`${variable.key}=${referenceName ?? ""}`} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate font-mono text-sm">{variable.key}</span>
          {referenceName ? (
            <ReferenceValueInput
              label={`${variable.key} value`}
              value={referenceValues[referenceName] ?? ""}
              locked={locked}
              onChange={value => onReferenceValueChange(referenceName, value)}
            />
          ) : (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Secret
              <Switch
                aria-label={`Keep ${variable.key} secret`}
                checked={secretVariables.has(key)}
                disabled={locked}
                onCheckedChange={checked => onToggleSecret(key, checked)}
              />
            </label>
          )}
        </div>
      );
    })}

    {service.credentials.map(({ field, referenceName }) =>
      referenceName ? (
        <div key={field} className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-sm">{CREDENTIAL_LABELS[field]}</span>
          <ReferenceValueInput
            label={`${CREDENTIAL_LABELS[field]} value`}
            value={referenceValues[referenceName] ?? ""}
            locked={locked}
            onChange={value => onReferenceValueChange(referenceName, value)}
          />
        </div>
      ) : null
    )}

    {service.credentials.length > 0 && <p className="text-xs text-muted-foreground">Registry credentials are always saved as secrets.</p>}
  </section>
);

interface ReferenceValueInputProps {
  label: string;
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
}

const ReferenceValueInput: FC<ReferenceValueInputProps> = ({ label, value, locked, onChange }) => (
  <Input
    aria-label={label}
    type="password"
    autoComplete="new-password"
    placeholder="Enter the secret's value"
    value={value}
    disabled={locked}
    onChange={event => onChange(event.target.value)}
    inputClassName="h-9"
    className="flex-[2]"
  />
);
