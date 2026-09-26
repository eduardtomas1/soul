import { useSettings } from "@/lib/settings";
import { Field, Segmented, Toggle } from "@/components/primitives";
import { SettingsCard } from "./settings-card";

export function GeneralSection() {
  const { settings, update } = useSettings();
  return (
    <div className="flex flex-col gap-4">
      <SettingsCard title="Appearance">
        <Field label="Theme" group><Segmented value={settings.theme} onChange={(theme) => void update({ theme })} options={[{ value: "system", label: "Follow system" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "natural", label: "Natural" }]} /></Field>
        <Field label="Motion" group hint="Numbers count up, charts draw in and panels slide into place. Turn it off here or through your system settings."><Segmented value={settings.reduceMotion} onChange={(reduceMotion) => void update({ reduceMotion })} options={[{ value: "system", label: "Follow system" }, { value: "always", label: "Reduce" }]} /></Field>
      </SettingsCard>
      <SettingsCard title="Reminders">
        <Toggle checked={settings.remindersEnabled} onChange={(remindersEnabled) => void update({ remindersEnabled })} label="Desktop notifications" description="For routines and habits that have a reminder time. Nothing is sent if the item is already done." />
        <Toggle checked={settings.launchAtLogin} onChange={(launchAtLogin) => void update({ launchAtLogin })} label="Open Soul at login" description="Reminders only fire while Soul is running. Applies to installed builds." />
      </SettingsCard>
    </div>
  );
}
