import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, FileUp, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  createEnvironmentVariable,
  deleteEnvironmentVariable,
  errorMessage,
  getEnvironmentVariables,
  importEnvironmentVariables,
  replaceEnvironmentVariable,
  type EnvironmentVariableInput,
  type Project,
} from "@/lib/api";

const empty: EnvironmentVariableInput = {
  key: "",
  value: "",
  classification: "secret",
  allowAgentAccess: false,
};

export function EnvironmentVariablesPanel({ project }: { project: Project }) {
  const queryClient = useQueryClient();
  const [repositoryId, setRepositoryId] = useState("");
  const [form, setForm] = useState(empty);
  const [replace, setReplace] = useState(false);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<string[]>([]);
  const queryKey = ["environment-variables", project.id, repositoryId || "project"];
  const variables = useQuery({
    queryKey,
    queryFn: () => getEnvironmentVariables(project.id, repositoryId || undefined),
  });
  useEffect(() => {
    setPreview([]);
    setImportText("");
  }, [repositoryId]);
  const refresh = async () => {
    setForm(empty);
    setReplace(false);
    setPreview([]);
    setImportText("");
    await queryClient.invalidateQueries({ queryKey });
  };
  const save = useMutation({
    mutationFn: () =>
      (replace ? replaceEnvironmentVariable : createEnvironmentVariable)(
        project.id,
        form,
        repositoryId || undefined,
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (key: string) =>
      deleteEnvironmentVariable(project.id, key, repositoryId || undefined),
    onSuccess: refresh,
  });
  const importer = useMutation({
    mutationFn: (confirm: boolean) =>
      importEnvironmentVariables(
        project.id,
        {
          content: importText,
          confirm,
          classification: form.classification,
          allowAgentAccess: form.allowAgentAccess,
        },
        repositoryId || undefined,
      ),
    onSuccess: (result, confirm) =>
      confirm ? void refresh() : setPreview(result.variables.map((item) => item.key)),
  });
  const pending = save.isPending || remove.isPending || importer.isPending;
  const submit = () => {
    if (
      form.allowAgentAccess &&
      !window.confirm(
        "Allow this value to be passed to Codex or Claude? Agent output and tools may expose it.",
      )
    )
      return;
    save.mutate();
  };
  return (
    <section className="mt-8 min-w-0 border-t border-edge pt-6">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-5 shrink-0 text-glow" />
        <div>
          <h3 className="text-sm font-semibold">Environment Variables</h3>
          <p className="mt-1 text-xs text-muted">
            Encrypted at rest. Saved values are permanently masked and never returned by the API.
          </p>
        </div>
      </div>

      <div className="mt-4 max-w-md min-w-0">
        <label className="min-w-0 text-xs">
          Scope
          <select
            value={repositoryId}
            onChange={(event) => setRepositoryId(event.target.value)}
            className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-edge bg-void px-3 text-sm"
          >
            <option value="">Project · shared by all repositories</option>
            {project.repositories.map((repository) => (
              <option key={repository.id} value={repository.id}>
                {repository.name} · overrides project
              </option>
            ))}
          </select>
        </label>
      </div>

      {variables.isPending ? (
        <p className="mt-4 text-xs text-muted">Loading variable names…</p>
      ) : variables.isError ? (
        <p role="alert" className="mt-4 text-xs text-danger">
          {errorMessage(variables.error)}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {variables.data.variables.length === 0 && (
            <div className="rounded-lg border border-dashed border-edge p-4 text-xs text-muted">
              No variables saved. An <code>.env.example</code> file is optional and not required.
            </div>
          )}
          {variables.data.variables.map((variable) => (
            <div
              key={`${variable.scope}-${variable.id}`}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-edge p-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <code className="max-w-full break-all text-sm">{variable.key}</code>
                  <span className="rounded bg-edge px-1.5 py-0.5 text-[9px] uppercase">
                    {variable.classification}
                  </span>
                  {variable.inherited && (
                    <span className="text-[9px] uppercase text-muted">
                      {variable.overridden ? "Inherited · overridden" : "Inherited"}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted">
                  <EyeOff className="size-3" />
                  •••••••• ·{" "}
                  {variable.allowAgentAccess ? "Agent access allowed" : "Agent access blocked"}
                </div>
                {variable.key.startsWith("VITE_") && (
                  <p className="mt-1 text-[10px] text-alert">
                    VITE_* values become public in browser bundles.
                  </p>
                )}
              </div>
              {!variable.inherited && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setForm({
                        key: variable.key,
                        value: "",
                        classification: variable.classification,
                        allowAgentAccess: variable.allowAgentAccess,
                      });
                      setReplace(true);
                    }}
                  >
                    Replace
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    aria-label={`Delete ${variable.key}`}
                    onClick={() =>
                      window.confirm(`Delete ${variable.key}? This cannot be undone.`) &&
                      remove.mutate(variable.key)
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {variables.data.suggestions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[10px] uppercase text-muted">Suggested by .env.example</span>
              {variables.data.suggestions.map((key) => (
                <button
                  type="button"
                  key={key}
                  className="max-w-full break-all rounded border border-edge px-2 py-1 text-left font-mono text-[10px] hover:border-glow"
                  onClick={() => {
                    setReplace(false);
                    setForm({ ...empty, key });
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid min-w-0 gap-4 rounded-lg border border-edge bg-void/40 p-3 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <h4 className="text-xs font-medium">
            {replace ? `Replace ${form.key}` : "Add variable"}
          </h4>
          <Input
            placeholder="VARIABLE_NAME"
            value={form.key}
            disabled={replace || pending}
            onChange={(event) => setForm({ ...form, key: event.target.value })}
          />
          <Textarea
            rows={4}
            placeholder="Value (multiline supported)"
            value={form.value}
            disabled={pending}
            onChange={(event) => setForm({ ...form, value: event.target.value })}
          />
          <Controls form={form} setForm={setForm} disabled={pending} />
          {form.key.startsWith("VITE_") && (
            <Warning>
              VITE_* is embedded into the frontend bundle and is public even when classified Secret.
            </Warning>
          )}
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending || !form.key || !form.value} onClick={submit}>
              <Plus className="mr-2 size-4" />
              {replace ? "Save replacement" : "Add variable"}
            </Button>
            {replace && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setReplace(false);
                  setForm(empty);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
        <div className="min-w-0 space-y-3">
          <h4 className="flex items-center gap-2 text-xs font-medium">
            <FileUp className="size-4" />
            Import .env
          </h4>
          <Textarea
            rows={6}
            placeholder={"API_URL=https://example.test\nFEATURE_FLAG=true"}
            value={importText}
            disabled={pending}
            onChange={(event) => {
              setImportText(event.target.value);
              setPreview([]);
            }}
          />
          <p className="text-[10px] text-muted">
            Parsed as dotenv text only. Shell expansion and command substitution are rejected. No
            file is written to a repository.
          </p>
          {preview.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded border border-edge p-2">
              <p className="mb-1 text-[10px] uppercase text-muted">Preview names only</p>
              {preview.map((key) => (
                <code key={key} className="block break-all text-xs">
                  {key}
                </code>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={pending || !importText}
              onClick={() => importer.mutate(false)}
            >
              Preview names
            </Button>
            {preview.length > 0 && (
              <Button
                disabled={pending}
                onClick={() =>
                  form.allowAgentAccess &&
                  !window.confirm("Allow every imported value to be passed to agents?")
                    ? undefined
                    : importer.mutate(true)
                }
              >
                Confirm import
              </Button>
            )}
          </div>
        </div>
      </div>
      {(save.isSuccess || remove.isSuccess || (importer.isSuccess && preview.length === 0)) && (
        <p aria-live="polite" className="mt-3 text-xs text-success">
          Environment variables updated.
        </p>
      )}
      {(save.isError || remove.isError || importer.isError) && (
        <p role="alert" className="mt-3 text-xs text-danger">
          {errorMessage(save.error ?? remove.error ?? importer.error)}
        </p>
      )}
    </section>
  );
}

function Controls({
  form,
  setForm,
  disabled,
}: {
  form: EnvironmentVariableInput;
  setForm: (value: EnvironmentVariableInput) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs">
        Classification
        <select
          value={form.classification}
          disabled={disabled}
          onChange={(event) =>
            setForm({ ...form, classification: event.target.value as "secret" | "public" })
          }
          className="mt-1 min-h-11 w-full rounded-md border border-edge bg-void px-3"
        >
          <option value="secret">Secret</option>
          <option value="public">Public</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-edge px-3 text-xs">
        Allow agent access
        <Switch
          checked={form.allowAgentAccess}
          disabled={disabled}
          onCheckedChange={(checked) => setForm({ ...form, allowAgentAccess: checked })}
        />
      </label>
    </div>
  );
}
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-alert/40 bg-alert-soft p-2 text-[10px] text-alert">
      <ShieldAlert className="size-4 shrink-0" />
      {children}
    </div>
  );
}
