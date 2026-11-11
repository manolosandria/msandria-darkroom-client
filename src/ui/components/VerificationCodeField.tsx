"use client";

import "./verificationCode.css";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  label?: string;
};

/**
 * The six digits an emailed code carries. Anything else typed or pasted (spaces,
 * dashes, letters) is dropped, and the browser may fill it in from the message
 * (`one-time-code`). Shared by email sign-in and Contact.
 */
export function VerificationCodeField({
  value,
  onChange,
  disabled = false,
  label = "6-digit code",
}: Props) {
  return (
    <label className="verification-code">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) =>
          onChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        disabled={disabled}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={12}
        placeholder="000000"
        spellCheck={false}
        autoFocus
      />
    </label>
  );
}
