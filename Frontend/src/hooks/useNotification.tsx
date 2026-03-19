import { useState } from "react";

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

  return {
    notification,
    showSuccessNotification: showSuccess,
    showErrorNotification: showError,
    hideNotification: hide,
  };
}

