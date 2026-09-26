import { clsx } from "clsx";
import { useState } from "react";
import { modelNameSchema } from "@shared/contracts/settings";
import { useQuery } from "@/lib/query";
import { useSettings } from "@/lib/settings";
import { Button, InlineError, Pill, TextInput } from "@/components/primitives";
import { SettingsCard } from "./settings-card";

export function AssistantSection() {
  const { settings, update } = useSettings();
  const providers = useQuery("assistant.providers", { refresh: true }, []);
  const [model, setModel] = useState(settings.assistantModel);
  const [modelError, setModelError] = useState<string | null>(null);
  const saveModel = async () => {
    const parsed = modelNameSchema.safeParse(model);
    if (!parsed.success) return setModelError(parsed.error.issues[0]?.message ?? "That model name is not valid.");
    setModelError(null);
    try {
      await update({ assistantModel: parsed.data });
    } catch (caught) {
      setModelError(caught instanceof Error ? caught.message : "Could not save the model.");
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <SettingsCard title="Providers" description="Soul runs the command line tools already installed and signed in on this computer. It never stores API keys.">
        <div className="flex flex-col divide-y divide-border">
          {(providers.data ?? []).map((provider) => (
            <div key={provider.id} className="flex items-center gap-3 py-2">
              <span className={clsx("h-2 w-2 rounded-full", provider.installed ? "bg-success" : "bg-faint")} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium">{provider.name} {provider.version && <span className="font-normal text-muted">{provider.version}</span>}</div>
                <div className="truncate text-[12px] text-muted">{provider.installed ? provider.executable : provider.detail}</div>
              </div>
              {settings.assistantProvider === provider.id ? <Pill>Default</Pill> : <Button size="sm" variant="ghost" onClick={() => void update({ assistantProvider: provider.id })}>Make default</Button>}
            </div>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="self-start" onClick={() => providers.reload()}>Check again</Button>
      </SettingsCard>
      <SettingsCard title="Model" description="Optional. Passed to the provider as its model name; leave empty for the provider's default.">
        <div className="flex gap-2">
          <TextInput value={model} onChange={(event) => setModel(event.target.value)} placeholder="Provider default" className="max-w-[320px]" />
          <Button onClick={() => void saveModel()} disabled={model.trim() === settings.assistantModel}>Save</Button>
        </div>
        <InlineError message={modelError} />
      </SettingsCard>
      <SettingsCard title="What the assistant can see" description="Claude Code gets read-only tools for your finances, habits and routines, and nothing else. Codex gets a summary of the same data with your question and works in its read-only sandbox. Neither can change anything in Soul. Your question and that data go to the provider you chose, under your own account." />
    </div>
  );
}
