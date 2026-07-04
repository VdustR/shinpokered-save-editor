import { useRegisterSW } from "virtual:pwa-register/react";
import "./update-prompt.css";

export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__dot" aria-hidden />
      <div className="toast__text">
        {needRefresh ? (
          <>
            <strong>Update available</strong>
            <span>A newer version is ready.</span>
          </>
        ) : (
          <>
            <strong>Ready offline</strong>
            <span>This editor now works without a connection.</span>
          </>
        )}
      </div>
      <div className="toast__actions">
        {needRefresh && (
          <button className="btn btn--primary btn--sm" onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
        )}
        <button className="btn btn--ghost btn--sm" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
