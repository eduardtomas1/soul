import { useState } from "react";
import { useNavigation } from "@/lib/navigation";
import { Tabs } from "@/components/primitives";
import { Page } from "@/features/shell/page";
import { AboutSection } from "./about-section";
import { AssistantSection } from "./assistant-section";
import { BackupSection } from "./backup-section";
import { GeneralSection } from "./general-section";

type Section = "general" | "backup" | "assistant" | "about";
const SECTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "general", label: "General" },
  { value: "backup", label: "Backup" },
  { value: "assistant", label: "Assistant" },
  { value: "about", label: "About" },
];

export function SettingsView() {
  const { route } = useNavigation();
  const [section, setSection] = useState<Section>(SECTIONS.some((entry) => entry.value === route.tab) ? (route.tab as Section) : "general");
  return (
    <Page title="Settings" subtitle="Soul keeps everything on this computer unless you say otherwise." tabs={<Tabs value={section} onChange={setSection} options={SECTIONS} />}>
      {section === "general" && <GeneralSection />}
      {section === "backup" && <BackupSection />}
      {section === "assistant" && <AssistantSection />}
      {section === "about" && <AboutSection />}
    </Page>
  );
}
