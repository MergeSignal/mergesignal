import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Mantine's `colors` array cannot accept CSS variable references — it requires
// concrete hex stops for its internal color system. These values are derived
// from the --ms-color-accent / --ms-color-ink / --ms-color-canvas primitives
// defined in globals.css. Update both locations together on a rebrand.
//
// The scale runs lightest (0) → darkest (9), centered around the brand accent
// which is near-white on the dark canvas: --ms-color-accent ≈ color-mix(white 92%, ink 8%).
const MS_ACCENT_STOPS: MantineColorsTuple = [
  "#f8f9ff", // 0 — near-white tint
  "#edf0fb", // 1
  "#d8dff6", // 2
  "#bcc8ee", // 3
  "#9cace4", // 4
  "#7b90d9", // 5
  "#5a74cc", // 6
  "#3f5bbf", // 7 — primary interactive accent
  "#2b44a8", // 8
  "#1a2e8a", // 9 — deepest
];

export const theme = createTheme({
  primaryColor: "accent",
  defaultRadius: "sm",
  colors: { accent: MS_ACCENT_STOPS },
});
