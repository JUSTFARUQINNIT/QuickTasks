import { auth } from "../lib/firebaseClient";

function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:8787";
}

export async function deleteTask(taskId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const token = await user.getIdToken();
  const res = await fetch(
    `${getApiBaseUrl()}/delete-task/${encodeURIComponent(taskId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.uid }),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to delete task (${res.status})`);
  }
}

