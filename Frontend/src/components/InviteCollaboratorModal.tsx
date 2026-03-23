import { useState, type FormEvent } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  runTransaction,
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
  const { notification, showSuccessNotification, showErrorNotification } =
    useNotification();

  async function findExistingInviteStatus(
    taskId: string,
    invitedEmail: string,
  ): Promise<null | { status: string }> {
    const existingInvitesQuery = query(
      collection(db, "taskInvites"),
      where("taskId", "==", taskId),
      where("invitedEmail", "==", invitedEmail),
    );

    const snap = await getDocs(existingInvitesQuery);
    if (snap.empty) return null;

    const data = snap.docs[0].data() as { status?: string };
    return { status: typeof data.status === "string" ? data.status : "" };
  }

  function getDeterministicInviteDocId(taskId: string, invitedEmail: string) {
    // Encode email to keep docId deterministic & safe under special characters.
    return `${taskId}_${encodeURIComponent(invitedEmail)}`;
  }


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      const msg = "Email is required.";
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
        showErrorNotification(msg);
        return;
      }

      const invitedUserDoc = snap.docs[0];
      const invitedUserId = invitedUserDoc.id;

      // 1) Check for an existing invite with the same {taskId, invitedEmail}.
      const existing = await findExistingInviteStatus(task.id, trimmedEmail);
      if (existing) {
        if (existing.status === "pending") {
          showErrorNotification("An invitation has already been sent.");
          return;
        }
        if (existing.status === "accepted") {
          showErrorNotification("User is already a collaborator.");
          return;
        }
        showErrorNotification("An invitation already exists.");
        return;
      }

      // 2) Create with a deterministic document ID to avoid duplicates under race conditions.
      const inviteDocId = getDeterministicInviteDocId(task.id, trimmedEmail);
      const inviteRef = doc(db, "taskInvites", inviteDocId);

      const txnResult = await runTransaction(db, async (tx) => {
        const existingSnap = await tx.get(inviteRef);
        if (existingSnap.exists()) {
          const data = existingSnap.data() as { status?: string };
          return {
            created: false,
            status: typeof data.status === "string" ? data.status : "",
          };
        }

        tx.set(inviteRef, {
          taskId: task.id,
          taskTitle: task.title,
          invitedEmail: trimmedEmail,
          invitedUserId,
          invitedBy: currentUser.uid,
          invitedByEmail: currentUser.email,
          status: "pending",
          createdAt: serverTimestamp(),
        });

        return { created: true, status: "pending" };
      });

      if (!txnResult.created) {
        if (txnResult.status === "pending") {
          showErrorNotification("An invitation has already been sent.");
          return;
        }
        if (txnResult.status === "accepted") {
          showErrorNotification("User is already a collaborator.");
          return;
        }
        showErrorNotification("An invitation already exists.");
        return;
      }

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

      showSuccessNotification("Invitation sent.");
      setEmail("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send invitation.";
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
