export const themeOptions = [
  { value: "light", label: "Terang" },
  { value: "dark", label: "Gelap" },
  { value: "system", label: "Ikuti Sistem" }
] as const;

export type ThemeOptionValue = (typeof themeOptions)[number]["value"];
