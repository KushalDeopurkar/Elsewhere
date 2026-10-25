export default function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="panel is-error" role="alert">
      <p className="panel-title">Couldn&rsquo;t load events</p>
      <p className="panel-body">{message}</p>
      {onRetry && (
        <div className="panel-actions">
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
