export function DisplayIcon({ kind }: { kind: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      {kind === "mobile" ? (
        <>
          <rect x="8" y="2" width="12" height="24" rx="2" />
          <path d="M12 22h4" />
        </>
      ) : kind === "desktop" ? (
        <>
          <rect x="2" y="4" width="24" height="16" rx="2" />
          <path d="M14 20v5M8 25h12" />
        </>
      ) : kind === "landscape" ? (
        <rect x="2" y="6" width="24" height="16" rx="1" />
      ) : kind === "portrait" ? (
        <rect x="6" y="2" width="16" height="24" rx="1" />
      ) : kind === "square" ? (
        <rect x="4" y="4" width="20" height="20" rx="1" />
      ) : kind === "screen" ? (
        <>
          <rect x="1" y="4" width="26" height="18" rx="1" />
          <path d="M5 25l2-3m16 3l-2-3" />
        </>
      ) : (
        <>
          <rect x="3" y="3" width="9" height="9" />
          <rect x="16" y="3" width="9" height="9" />
          <rect x="3" y="16" width="9" height="9" />
          <rect x="16" y="16" width="9" height="9" />
        </>
      )}
    </svg>
  );
}
