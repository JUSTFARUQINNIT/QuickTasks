import type { NotificationState } from "../hooks/useNotification";
import { HiCheckCircle, HiExclamationCircle } from "react-icons/hi2";

type Props = {
  notification: NotificationState;
};

export function NotificationBanner({ notification }: Props) {
  if (!notification.show || !notification.message) return null;

  return (
    <div className={`notification notification--${notification.type}`}>
      <div className="notification-content">
        {notification.type === "success" ? (
          <HiCheckCircle className="notification-icon" />
        ) : (
          <HiExclamationCircle className="notification-icon" />
        )}
        <span className="notification-message">{notification.message}</span>
      </div>
    </div>
  );
}

