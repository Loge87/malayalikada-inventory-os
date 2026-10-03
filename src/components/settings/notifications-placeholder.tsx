import { BellOff } from "lucide-react";

/** Not a real feature yet — just the tab and this empty state, per the
 *  settings-restructure plan. */
export function NotificationsPlaceholder() {
  return (
    <div className="empty-state">
      <BellOff className="size-6" />
      <p>Notification settings aren&apos;t available yet.</p>
    </div>
  );
}
