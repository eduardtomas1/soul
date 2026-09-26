import { ChatCircleText, GearSix, Gauge, ListChecks, NotePencil, Repeat, SquaresFour, Wallet, type Icon } from "@phosphor-icons/react";
import type { View } from "@/lib/navigation";

export interface NavItem {
  readonly view: View;
  readonly label: string;
  readonly icon: Icon;
  readonly section: "Modules" | "Tools" | null;
  readonly keywords: string;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { view: "today", label: "Overview", icon: SquaresFour, section: null, keywords: "today dashboard log day" },
  { view: "journal", label: "Journal", icon: NotePencil, section: "Modules", keywords: "diary notes mood energy calendar history log" },
  { view: "routines", label: "Routines", icon: ListChecks, section: "Modules", keywords: "checklists" },
  { view: "habits", label: "Habits", icon: Repeat, section: "Modules", keywords: "streaks milestones" },
  { view: "measures", label: "Measures", icon: Gauge, section: "Modules", keywords: "weight sleep steps body trackers numbers" },
  { view: "finances", label: "Finance", icon: Wallet, section: "Modules", keywords: "money budget transactions accounts" },
  { view: "assistant", label: "Assistant", icon: ChatCircleText, section: "Tools", keywords: "ai chat claude codex" },
];

export const SETTINGS_ITEM: NavItem = { view: "settings", label: "Settings", icon: GearSix, section: null, keywords: "backup drive theme" };
