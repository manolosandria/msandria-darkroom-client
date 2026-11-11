import "./feedback.css";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({ message, onRetry, className = '' }: ErrorMessageProps) {
  return (
    <div className={`error-state ${className}`}>
      <svg
        className="error-state__icon"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6.2v4.4M10 13.6v.2" />
      </svg>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="error-state__retry">
          Try Again
        </button>
      )}
    </div>
  );
}
