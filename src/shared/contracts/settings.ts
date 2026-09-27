import { z } from "zod";
import { providerIdSchema } from "./assistant";

export const themeSchema = z.enum(["system", "light", "dark", "slate"]);
export type Theme = z.infer<typeof themeSchema>;

export const settingsSchema = z.object({
  theme: themeSchema,
  remindersEnabled: z.boolean(),
  launchAtLogin: z.boolean(),
  reduceMotion: z.enum(["system", "always"]),
  assistantProvider: providerIdSchema,
  assistantModel: z.string().max(80),
  onboardingDone: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  remindersEnabled: true,
  launchAtLogin: false,
  reduceMotion: "system",
  assistantProvider: "claude",
  assistantModel: "",
  onboardingDone: false,
};

export const modelNameSchema = z.string().trim().max(80).regex(/^(?:\w[\w.:/@[\]-]*)?$/u, "Start the model name with a letter or digit, and use only letters, digits and . : / @ - _ [ ].");

export const settingsPatchSchema = settingsSchema.partial().extend({ assistantModel: modelNameSchema.optional() });
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
