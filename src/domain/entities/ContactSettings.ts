export type ContactSettings = {
  version: number;
  eyebrow: string;
  title: string;
  description: string;
  buttonText: string;
  layout: "split" | "stacked";
  headingFont: "serif" | "sans" | "mono";
  showFacts: boolean;
  background: string;
  surface: string;
  text: string;
  accent: string;
};
export const defaultContactSettings: ContactSettings = {
  version: 1,
  eyebrow: "GET IN TOUCH",
  title: "Let's talk photography.",
  description: "Send a private message to the photographer.",
  buttonText: "Send message",
  layout: "split",
  headingFont: "serif",
  showFacts: true,
  background: "#f3f2ef",
  surface: "#ffffff",
  text: "#262923",
  accent: "#4f7a3c",
};
export interface ContactSettingsRepository {
  get(): Promise<ContactSettings>;
  save(settings: ContactSettings): Promise<ContactSettings>;
}
