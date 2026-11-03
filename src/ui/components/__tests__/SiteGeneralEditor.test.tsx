import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { defaultSiteSettings } from "@/src/domain/entities/SiteSettings";
import type { ManageSiteSettings } from "@/src/application/use-cases/ManageSiteSettings";

vi.mock("../EditingWorkspace", () => ({
  useEditingWorkspace: () => ({ confirm: async () => true }),
  useUnsavedEditor: (_dirty: boolean, editor: { save: () => Promise<boolean> }) => ({
    review: () => editor.save(),
  }),
}));

const { default: SiteGeneralEditor } = await import("../SiteGeneralEditor");
const { SiteSettingsProvider } = await import("../SiteSettingsProvider");

function serviceWith() {
  return {
    get: vi.fn().mockResolvedValue(defaultSiteSettings),
    save: vi.fn(async (settings) => ({ ...settings, version: 2 })),
  };
}

describe("SiteGeneralEditor", () => {
  it("saves the header, fonts and palette chosen and applies them to the site", async () => {
    const service = serviceWith();
    render(
      <SiteSettingsProvider service={service}>
        <SiteGeneralEditor service={service as unknown as ManageSiteSettings} />
      </SiteSettingsProvider>,
    );

    await userEvent.click(await screen.findByRole("radio", { name: "Dark" }));
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Hide it on scroll/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use the Night palette" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save general settings" }),
    );

    expect(service.save).toHaveBeenCalledWith(
      expect.objectContaining({
        header: { style: "dark", navAlign: "end", hideOnScroll: false },
        palette: expect.objectContaining({ background: "#171b20" }),
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "General settings saved.",
    );
    expect(
      document.documentElement.style.getPropertyValue("--site-background"),
    ).toBe("#171b20");
  });

  it("explains a failed load and offers to reload", async () => {
    const service = serviceWith();
    service.get.mockRejectedValueOnce(new Error("Could not load."));
    render(
      <SiteGeneralEditor service={service as unknown as ManageSiteSettings} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");
    await userEvent.click(screen.getByRole("button", { name: "Reload state" }));
    expect(await screen.findByRole("radio", { name: "Light" })).toBeChecked();
  });
});
