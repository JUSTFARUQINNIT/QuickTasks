import { useEffect, useState, type FormEvent } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";
import { NotificationBanner } from "./NotificationBanner";
import { useNotification } from "../hooks/useNotification";
import type { Task } from "../types/tasks";

type InviteCollaboratorModalProps = {
  task: Task;
  onClose: () => void;
};

export function InviteCollaboratorModal({
  task,
  onClose,
}: InviteCollaboratorModalProps) {
  const [email, setEmail] = useState(task.assigned_email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { notification, showSuccessNotification, showErrorNotification } =
    useNotification();

  useEffect(() => {
    if (!error && !success) return;
    const timeoutId = window.setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 4000);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [error, success]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      const msg = "Email is required.";
      setError(msg);
      showErrorNotification(msg);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("You must be signed in to send invitations.");
      }

      setLoading(true);

      const usersRef = collection(db, "profiles");
      const q = query(usersRef, where("email", "==", trimmedEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        const msg = "User not found";
        setError(msg);
        showErrorNotification(msg);
        return;
      }

      const invitedUserDoc = snap.docs[0];
      const invitedUserId = invitedUserDoc.id;

      await addDoc(collection(db, "taskInvites"), {
        taskId: task.id,
        taskTitle: task.title,
        invitedEmail: trimmedEmail,
        invitedUserId,
        invitedBy: currentUser.uid,
        invitedByEmail: currentUser.email,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const rawBase =
        (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const apiBase = rawBase.replace(/\/$/, "");

      const res = await fetch(`${apiBase}/send-task-invite-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          taskTitle: task.title,
          invitedBy: currentUser.email,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Could not send invite email.");
      }

      setSuccess("Invitation sent.");
      showSuccessNotification("Invitation sent.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send invitation.";
      setError(message);
      showErrorNotification(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">Invite collaborator</h2>
        <p className="modal-subtitle">
          Share this task with another QuickTasks user.
        </p>

        <form className="tasks-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="collaborator@example.com"
              required
            />
          </label>

          <div className="invitation-form-actions">
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? "Sending…" : "Send invite"}
            </button>
            <button
              type="button"
              className="ghost-btn tasks-cancel-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>

        <NotificationBanner notification={notification} />
      </div>
    </div>
  );
}
