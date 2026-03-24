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

export type UploadedAttachment = {
  id: string;
  taskId?: string;
  originalName?: string;
  uniqueName?: string;
  uploadedBy?: string;
  driveFileId?: string | null;
  createdAt?: string;
  name?: string;
  type: string;
  size: number;
  url: string;
  viewUrl?: string | null;
  view_url?: string | null;
  drive_file_id?: string | null;
  uploaded_by?: string;
  uploaded_at?: string;
};

export async function uploadTaskAttachment(
  taskId: string,
  file: File,
): Promise<UploadedAttachment> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(
    `${getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/attachments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Upload failed (${res.status})`);
  }

  return body.attachment as UploadedAttachment;
}

export async function deleteTaskAttachment(
  taskId: string,
  attachmentId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const token = await user.getIdToken();
  const res = await fetch(
    `${getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Delete failed (${res.status})`);
  }
}

