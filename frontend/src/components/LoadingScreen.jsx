// Shown while the app asks the server "who is signed in?" on first load.
export default function LoadingScreen() {
  return (
    <div className="screen-loading" role="status" aria-live="polite">
      <span className="screen-loading__spinner" aria-hidden="true" />
      <span className="muted">Loading…</span>
    </div>
  );
}
