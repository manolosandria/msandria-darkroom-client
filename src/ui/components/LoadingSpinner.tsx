import "./feedback.css";

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export function LoadingSpinner({ message = "Loading...", className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`loading-state ${className}`}>
      <span className="loading-state__ring" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
