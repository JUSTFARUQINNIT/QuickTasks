export type Priority = "low" | "medium" | "high";

export type Subtask = {
  id: string;
  text: string;
  completed: boolean;
  completed_by?: string | null; // UID of who completed it
  assigned_to?: string | null; // UID of assigned collaborator
  role?: string | null; // Role of the subtask (collaborator, reviewer, etc.)
  due_date?: string | null; // Due date for the subtask
  created_at: string;
  completed_at?: string | null;
};

export type Attachment = {
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
  name?: string; // legacy field
  type?: string;
  size?: number;
  url: string;
  viewUrl?: string | null;
  view_url?: string | null; // legacy field
  drive_file_id?: string | null; // legacy field
  uploaded_by?: string; // legacy field
  uploaded_at?: string; // legacy field
};

export type Task = {
  id: string;
  title: string;
  shared: boolean;
  description: string | null;
  due_date: string | null;
  priority: Priority;
  completed: boolean;
  created_at: string;
  completed_at?: string | null;
  category: string | null;
  order: number;
  assigned_to?: string | null;
  assigned_email?: string | null;
  created_by?: string | null;
  collaborators?: string[];
  subtasks?: Subtask[];
  attachments?: Attachment[];
  /**
   * Owner UID for the master task (from `tasks/{taskId}.user_id`).
   * For invited tasks this is the original owner; for owned tasks it matches the current user.
   */
  ownerId?: string | null;
  /**
   * True when this task is a projection of another user's task that was shared via an invite.
   */
  isInvited?: boolean;
  /**
   * Reference ID of the original task document in `tasks/{taskId}`.
   * For invited tasks this is the master task ID; for owned tasks it may be undefined.
   */
  ref?: string | null;
  /**
   * Last time the projection was updated from the master task, as ISO string.
   */
  updatedAt?: string | null;
};
