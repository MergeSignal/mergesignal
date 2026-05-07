import {
  render,
  screen,
  within,
  waitFor,
  type RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { theme } from "../../theme";

// Wrap the component under test with the application MantineProvider so that
// all Mantine internals and CSS variable resolution work correctly in tests.
function ThemeWrapper({ children }: { children: React.ReactNode }) {
  return <MantineProvider theme={theme}>{children}</MantineProvider>;
}

export function renderWithTheme(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: ThemeWrapper, ...options });
}

export { screen, within, waitFor, userEvent };
