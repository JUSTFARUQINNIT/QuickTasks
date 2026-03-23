import { useEffect, useState } from "react";

export type NotificationState = {
  type: "success" | "error";
  message: string;
  show: boolean;
};

export function useNotification() {
  const [notification, setNotification] = useState<NotificationState>({
    type: "success",
    message: "",
    show: false,
  });

  function showSuccess(message: string) {
    setNotification({ type: "success", message, show: true });
  }

  function showError(message: string) {
    setNotification({ type: "error", message, show: true });
  }

  function hide() {
    setNotification((prev) => ({ ...prev, show: false }));
  }

  // Auto-hide after 3 seconds whenever a notification is shown.
  useEffect(() => {
    if (!notification.show) return;
    const timeoutId = window.setTimeout(() => {
      hide();
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, [notification.show]);

  return {
    notification,
    showSuccessNotification: showSuccess,
    showErrorNotification: showError,
    hideNotification: hide,
  };
}
