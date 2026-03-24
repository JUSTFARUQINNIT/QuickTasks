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
  mimeType?: string;
  iconLink?: string | null;
  thumbnailLink?: string | null;
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
  onProgress?: (progress: number) => void,
): Promise<UploadedAttachment> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append("file", file);

  return await new Promise<UploadedAttachment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/attachments`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const progress = Math.round((event.loaded / event.total) * 100);
      onProgress(progress);
    };

    xhr.onload = () => {
      let body: any = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve(body?.attachment as UploadedAttachment);
        return;
      }

      reject(new Error(body?.error || `Upload failed (${xhr.status})`));
    };

    xhr.onerror = () => {
      reject(new Error("Network error while uploading file"));
    };

    xhr.send(formData);
  });
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

export async function removeTaskCollaborator(
  taskId: string,
  collaboratorId: string,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required");

  const token = await user.getIdToken();
  const res = await fetch(
    `${getApiBaseUrl()}/api/tasks/${encodeURIComponent(taskId)}/collaborators/${encodeURIComponent(collaboratorId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Failed to remove collaborator (${res.status})`);
  }
}

