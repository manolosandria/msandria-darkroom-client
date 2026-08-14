import { LoadingSpinner } from "./LoadingSpinner";
import { ErrorMessage } from "./ErrorMessage";

interface PhotoFetchStatusProps {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function PhotoFetchStatus({ loading, error, onRetry }: PhotoFetchStatusProps) {
  if (loading) return <LoadingSpinner message="Loading photo..." />;
  if (error) return <ErrorMessage message={error} onRetry={onRetry} className="mb-6" />;
  return null;
}
