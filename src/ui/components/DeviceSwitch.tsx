"use client";
import { KeyboardEvent, ReactNode } from "react";
import { DisplayIcon } from "./DisplayIcon";
import "./deviceSwitch.css";

export type PreviewDevice = "desktop" | "mobile";
const DEVICES: PreviewDevice[] = ["desktop", "mobile"];
const NAMES: Record<PreviewDevice, string> = {
  desktop: "Desktop",
  mobile: "Phone",
};
const TITLES: Record<PreviewDevice, string> = {
  desktop: "Desktop monitor",
  mobile: "Phone",
};

/**
 * The choice between a desktop monitor and a phone that every preview offers (Home,
 * Gallery, Collections): two radios with their drawings and names, the chosen one
 * dark green. Arrow keys switch between them. `tone="dark"` suits a dark stage.
 */
export function DeviceSwitch({
  value,
  onChange,
  label = "Preview device",
  tone = "light",
}: {
  value: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
  label?: string;
  tone?: "light" | "dark";
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    const next = value === "desktop" ? "mobile" : "desktop";
    onChange(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-device="${next}"]`)
      ?.focus();
  }
  return (
    <div
      className="device-switch"
      data-tone={tone}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {DEVICES.map((device) => (
        <button
          key={device}
          type="button"
          role="radio"
          data-device={device}
          aria-checked={value === device}
          tabIndex={value === device ? 0 : -1}
          title={TITLES[device]}
          onClick={() => onChange(device)}
        >
          <DisplayIcon kind={device} />
          <span>{NAMES[device]}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * A preview drawn inside a dark monitor with its stand, or a phone with rounded
 * corners and a speaker slot.
 */
export function DeviceFrame({
  device,
  className = "",
  children,
}: {
  device: PreviewDevice;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`device-frame device-frame--${device} ${className}`.trim()}>
      {children}
    </div>
  );
}
