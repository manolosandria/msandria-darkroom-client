import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    await userEvent.click(screen.getByRole("radio", { name: "Frosted glass" }));
    await userEvent.click(screen.getByRole("radio", { name: "Centered" }));
    await userEvent.click(
      screen.getByRole("switch", { name: /Hide it on scroll/ }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Use the Night palette" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Save general settings" }),
    );

    expect(service.save).toHaveBeenCalledWith(
      expect.objectContaining({
        header: {
          tone: "dark",
          material: "glass",
          navAlign: "center",
          hideOnScroll: false,
        },
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

  it("picks a tone's colors by hand, warns when faint and returns to the palette's", async () => {
    const service = serviceWith();
    render(
      <SiteGeneralEditor service={service as unknown as ManageSiteSettings} />,
    );

    const ground = await screen.findByLabelText("Dark header ground");
    expect(screen.getAllByText("From the palette")).toHaveLength(2);
    fireEvent.input(ground, { target: { value: "#eeeeee" } });
    expect(screen.getByText("Picked by hand")).toBeInTheDocument();
    expect(screen.getByText(/the links may be hard to read/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Use the palette's" }));
    expect(screen.getAllByText("From the palette")).toHaveLength(2);

    fireEvent.input(screen.getByLabelText("Light header text"), {
      target: { value: "#222222" },
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Use the Night palette" }),
    );
    expect(screen.getAllByText("From the palette")).toHaveLength(2);
    await userEvent.click(
      screen.getByRole("button", { name: "Save general settings" }),
    );
    expect(service.save.mock.calls[0][0].header).toEqual(
      defaultSiteSettings.header,
    );
  });

  it("reads settings saved with the older header style", async () => {
    const service = serviceWith();
    service.get.mockResolvedValueOnce({
      ...defaultSiteSettings,
      header: { style: "glass", navAlign: "end", hideOnScroll: true },
    });
    render(
      <SiteGeneralEditor service={service as unknown as ManageSiteSettings} />,
    );
    expect(await screen.findByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Frosted glass" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("explains a failed load and offers to reload", async () => {
    const service = serviceWith();
    service.get.mockRejectedValueOnce(new Error("Could not load."));
    render(
      <SiteGeneralEditor service={service as unknown as ManageSiteSettings} />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load.");
    await userEvent.click(screen.getByRole("button", { name: "Reload state" }));
    expect(await screen.findByRole("radio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
