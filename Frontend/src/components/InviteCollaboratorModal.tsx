import { useState, type FormEvent } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
  runTransaction,
  updateDoc,
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showErrorNotification("Email is required.");
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !currentUser.email) {
        throw new Error("You must be signed in to send invitations.");
      }

      setLoading(true);

      // 1️⃣ Fetch user by email
      const usersRef = collection(db, "profiles");
      const q = query(usersRef, where("email", "==", trimmedEmail));
      const snap = await getDocs(q);

      if (snap.empty) {
        showErrorNotification("User not found.");
        return;
      }

      const invitedUserDoc = snap.docs[0];
      const invitedUserId = invitedUserDoc.id;

      // 2️⃣ Fetch task and check current collaborators
      const taskRef = doc(db, "tasks", task.id);
      const taskSnap = await getDoc(taskRef); // ✅ Modular v9 syntax
      const taskData = taskSnap.data() || {};
      const collaborators: string[] = Array.isArray(taskData.collaborators)
        ? taskData.collaborators
        : [];

      if (collaborators.includes(invitedUserId)) {
        showErrorNotification("User is already a collaborator.");
        return;
      }

      // 3️⃣ Check for existing invite
      const existingInvitesQuery = query(
        collection(db, "taskInvites"),
        where("taskId", "==", task.id),
        where("invitedEmail", "==", trimmedEmail),
      );
      const inviteSnap = await getDocs(existingInvitesQuery);

      if (!inviteSnap.empty) {
        const existingDoc = inviteSnap.docs[0];
        const existingStatus = existingDoc.data().status;

        if (existingStatus === "pending") {
          showErrorNotification("An invitation has already been sent.");
          return;
        }
        if (existingStatus === "accepted") {
          showErrorNotification("User is already a collaborator.");
          return;
        }
        if (existingStatus === "declined") {
          // Use modular v9 syntax to update
          const docRef = doc(db, "taskInvites", existingDoc.id);
          await updateDoc(docRef, {
            status: "pending",
            invitedBy: currentUser.uid,
            invitedByEmail: currentUser.email,
            createdAt: serverTimestamp(),
          });
        }
      } else {
        // 4️⃣ No existing invite → create new invite
        const inviteDocId = `${task.id}_${encodeURIComponent(trimmedEmail)}`;
        const inviteRef = doc(db, "taskInvites", inviteDocId);

        await runTransaction(db, async (tx) => {
          const existingSnap = await tx.get(inviteRef);
          if (!existingSnap.exists()) {
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
          }
        });
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
