import { FolderOpen } from "@phosphor-icons/react";
import { invoke } from "@/lib/bridge";
import { useQuery } from "@/lib/query";
import { Button } from "@/components/primitives";
import { SettingsCard } from "./settings-card";

export function AboutSection() {
  const info = useQuery("app.info", undefined, []);
  return (
    <div className="flex flex-col gap-4">
      <SettingsCard title="Soul" description={info.data ? `Version ${info.data.version} · ${info.data.platform}` : undefined}>
        <div className="flex items-center gap-2">
          <Button size="sm" icon={<FolderOpen size={14} />} onClick={() => void invoke("app.revealDataDirectory")}>Open data folder</Button>
          <span className="truncate font-mono text-[12px] text-muted">{info.data?.dataDirectory}</span>
        </div>
      </SettingsCard>
      <SettingsCard title="Credits" description="Icons by Phosphor. Typeface IBM Plex Sans. Built with Electron, React and SQLite." />
    </div>
  );
}
