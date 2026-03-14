import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  addDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";

type TaskInvite = {
  id: string;
  taskId: string;
  taskTitle: string;
  invitedEmail: string;
  invitedUserId: string;
  invitedBy: string;
  invitedByEmail?: string | null;
  status: "pending" | "accepted" | "declined";
};

type TaskInviteWithLabel = TaskInvite & {
  invitedByLabel: string;
};

export function InvitationsPage() {
  const [receivedInvites, setReceivedInvites] = useState<TaskInviteWithLabel[]>(
    [],
  );
  const [acceptedInvites, setAcceptedInvites] = useState<TaskInviteWithLabel[]>(
    [],
  );
  const [sentInvites, setSentInvites] = useState<TaskInviteWithLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load(user: User) {
      try {
        setLoading(true);
        setError(null);

        const invitesRef = collection(db, "taskInvites");

        const [
          byUserIdPendingSnap,
          byEmailPendingSnap,
          byUserIdAcceptedSnap,
          byEmailAcceptedSnap,
          sentSnap,
        ] = await Promise.all([
          getDocs(
            query(
              invitesRef,
              where("invitedUserId", "==", user.uid),
              where("status", "==", "pending"),
            ),
          ),
          user.email
            ? getDocs(
                query(
                  invitesRef,
                  where("invitedEmail", "==", user.email.toLowerCase()),
                  where("status", "==", "pending"),
                ),
              )
            : Promise.resolve({
                docs: [] as Array<{ id: string; data: () => unknown }>,
              }),
          getDocs(
            query(
              invitesRef,
              where("invitedUserId", "==", user.uid),
              where("status", "==", "accepted"),
            ),
          ),
          user.email
            ? getDocs(
                query(
                  invitesRef,
                  where("invitedEmail", "==", user.email.toLowerCase()),
                  where("status", "==", "accepted"),
                ),
              )
            : Promise.resolve({
                docs: [] as Array<{ id: string; data: () => unknown }>,
              }),
          getDocs(query(invitesRef, where("invitedBy", "==", user.uid))),
        ]);
        if (!isMounted) return;

        const receivedSeen = new Set<string>();
        const receivedDocs = [
          ...byUserIdPendingSnap.docs,
          ...byEmailPendingSnap.docs,
        ].filter((d) => {
          if (receivedSeen.has(d.id)) return false;
          receivedSeen.add(d.id);
          return true;
        });

        const acceptedSeen = new Set<string>();
        const acceptedDocs = [
          ...byUserIdAcceptedSnap.docs,
          ...byEmailAcceptedSnap.docs,
        ].filter((d) => {
          if (acceptedSeen.has(d.id)) return false;
          acceptedSeen.add(d.id);
          return true;
        });

        const sentSeen = new Set<string>();
        const sentDocs = sentSnap.docs.filter((d) => {
          if (sentSeen.has(d.id)) return false;
          sentSeen.add(d.id);
          return true;
        });

        const receivedBase: TaskInvite[] = receivedDocs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TaskInvite, "id">),
        }));

        const acceptedBase: TaskInvite[] = acceptedDocs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TaskInvite, "id">),
        }));

        const sentBase: TaskInvite[] = sentDocs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<TaskInvite, "id">),
        }));

        if (
          receivedBase.length === 0 &&
          acceptedBase.length === 0 &&
          sentBase.length === 0
        ) {
          setReceivedInvites([]);
          setAcceptedInvites([]);
          setSentInvites([]);
          setLoading(false);
          return;
        }

        const inviterIds = Array.from(
          new Set([...receivedBase, ...sentBase].map((i) => i.invitedBy)),
        );
        const inviterLabels = new Map<string, string>();

        await Promise.all(
          inviterIds.map(async (uid) => {
            try {
              const inviterRef = doc(collection(db, "profiles"), uid);
              const inviterSnap = await getDoc(inviterRef);
              if (!inviterSnap.exists()) {
                inviterLabels.set(uid, uid);
                return;
              }
              const data = inviterSnap.data() as {
                email?: string | null;
                name?: string | null;
              };
              inviterLabels.set(uid, data.name ?? data.email ?? uid);
            } catch {
              inviterLabels.set(uid, uid);
            }
          }),
        );

        setAcceptedInvites(
          acceptedBase.map((invite) => ({
            ...invite,
            invitedByLabel:
              inviterLabels.get(invite.invitedBy) ??
              invite.invitedByEmail ??
              invite.invitedBy,
          })),
        );

        setReceivedInvites(
          receivedBase
            .filter((invite) => invite.status === "pending")
            .map((invite) => ({
              ...invite,
              invitedByLabel:
                inviterLabels.get(invite.invitedBy) ??
                invite.invitedByEmail ??
                invite.invitedBy,
            })),
        );
        setSentInvites(
          sentBase.map((invite) => ({
            ...invite,
            invitedByLabel:
              inviterLabels.get(invite.invitedBy) ??
              invite.invitedByEmail ??
              invite.invitedBy,
          })),
        );
        setLoading(false);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load invitations.";
        if (!isMounted) return;
        setError(message);
        setLoading(false);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;
      if (!user) {
        setReceivedInvites([]);
        setSentInvites([]);
        setLoading(false);
        return;
      }
      void load(user);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  async function handleAccept(invite: TaskInvite) {
    try {
      setActioningId(invite.id);
      setError(null);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("You must be signed in to accept invitations.");
      }

      await updateDoc(doc(db, "taskInvites", invite.id), {
        status: "accepted",
      });

      // Keep collaborators on the master task for backwards compatibility / analytics.
      await updateDoc(doc(db, "tasks", invite.taskId), {
        collaborators: arrayUnion(currentUser.uid),
      });

      // Load the master task so we can create a per-user projection with a stable snapshot.
      const masterRef = doc(db, "tasks", invite.taskId);
      const masterSnap = await getDoc(masterRef);
      if (!masterSnap.exists()) {
        throw new Error("The shared task no longer exists.");
      }
      const masterData = masterSnap.data() as {
        title?: string;
        description?: string | null;
        due_date?: string | null;
        priority?: string;
        category?: string | null;
        created_at?: string;
        order?: number;
        user_id?: string;
      };

      // Create / overwrite the invited user's projection:
      // userTasks/{invitedUserId}/tasks/{taskId}
      const userTaskRef = doc(
        collection(db, "userTasks", currentUser.uid, "tasks"),
        invite.taskId,
      );
      await setDoc(userTaskRef, {
        ref: invite.taskId,
        isInvited: true,
        userId: currentUser.uid,
        ownerId: masterData.user_id ?? invite.invitedBy,
        title: masterData.title ?? invite.taskTitle,
        description: masterData.description ?? null,
        due_date: masterData.due_date ?? null,
        priority: masterData.priority ?? "medium",
        category: masterData.category ?? null,
        created_at: masterData.created_at ?? new Date().toISOString(),
        order: typeof masterData.order === "number" ? masterData.order : 0,
        completed: false,
        updatedAt: serverTimestamp(),
      });

      // Notify the task owner that this invite was accepted.
      await addDoc(collection(db, "notifications"), {
        userId: invite.invitedBy,
        type: "inviteAccepted",
        taskId: invite.taskId,
        taskTitle: invite.taskTitle,
        collaboratorId: currentUser.uid,
        collaboratorEmail: currentUser.email ?? null,
        createdAt: serverTimestamp(),
        read: false,
      });

      setReceivedInvites((prev) => prev.filter((i) => i.id !== invite.id));
      setAcceptedInvites((prev) => [
        ...prev,
        {
          ...(invite as TaskInviteWithLabel),
          status: "accepted",
          invitedByLabel:
            (invite as TaskInviteWithLabel).invitedByLabel ?? invite.invitedBy,
        },
      ]);

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Invitation accepted", {
            body: `You’re now collaborating on “${invite.taskTitle}”.`,
            icon: "/quicktasks-logo.svg",
          });
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not accept invitation.";
      setError(message);
    } finally {
      setActioningId(null);
    }
  }

  async function handleDecline(invite: TaskInvite) {
    try {
      setActioningId(invite.id);
      setError(null);

      await updateDoc(doc(db, "taskInvites", invite.id), {
        status: "declined",
      });

      setReceivedInvites((prev) => prev.filter((i) => i.id !== invite.id));

      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification("Invitation declined", {
            body: `You declined the invitation for “${invite.taskTitle}”.`,
            icon: "/quicktasks-logo.svg",
          });
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not decline invitation.";
      setError(message);
    } finally {
      setActioningId(null);
    }
  }

  return (
    <div className="tasks-shell tasks-shell--tasks">
      <section className="tasks-panel tasks-list-panel">
        <div className="tasks-list-header">
          <h2 className="tasks-heading">Task invitations</h2>
          <p className="tasks-subtitle">
            Review collaboration invites for your tasks.
          </p>
        </div>

        {loading ? (
          <div className="tasks-empty">
            <div className="spinner" />
          </div>
        ) : receivedInvites.length === 0 &&
          acceptedInvites.length === 0 &&
          sentInvites.length === 0 ? (
          <div className="tasks-empty">
            <p>No invitations.</p>
          </div>
        ) : (
          <>
            {receivedInvites.length > 0 && (
              <>
                <h3 className="tasks-heading" style={{ marginTop: 24 }}>
                  Invitations for you
                </h3>
                <ul className="invitation-card-list">
                  {receivedInvites.map((invite) => (
                    <li key={invite.id} className="task-item">
                      <div className="task-card-header">
                        <div className="task-header-text">
                          <span className="task-title">{invite.taskTitle}</span>
                        </div>
                      </div>
                      <div className="task-card-body">
                        <div className="task-card-row">
                          <span className="task-card-label">Invited by</span>
                          <span className="task-card-value">
                            {invite.invitedByLabel}
                          </span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Your email</span>
                          <span className="task-card-value">
                            {invite.invitedEmail}
                          </span>
                        </div>
                      </div>
                      <div
                        className="invitation-form-actions"
                        style={{ marginTop: 16 }}
                      >
                        <button
                          type="button"
                          className="primary-btn"
                          onClick={() => void handleAccept(invite)}
                          disabled={actioningId === invite.id}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="ghost-btn tasks-cancel-btn"
                          onClick={() => void handleDecline(invite)}
                          disabled={actioningId === invite.id}
                        >
                          Decline
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {acceptedInvites.length > 0 && (
              <>
                <h3 className="tasks-heading" style={{ marginTop: 32 }}>
                  Accepted invitations
                </h3>
                <ul className="invitation-card-list">
                  {acceptedInvites.map((invite) => (
                    <li key={invite.id} className="task-item">
                      <div className="task-card-header">
                        <div className="task-header-text">
                          <span className="task-title">{invite.taskTitle}</span>
                        </div>
                        <span className="task-status task-status--completed task-status--pill">
                          Accepted
                        </span>
                      </div>
                      <div className="task-card-body">
                        <div className="task-card-row">
                          <span className="task-card-label">Invited by</span>
                          <span className="task-card-value">
                            {invite.invitedByLabel}
                          </span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Your email</span>
                          <span className="task-card-value">
                            {invite.invitedEmail}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sentInvites.length > 0 && (
              <>
                <h3 className="tasks-heading" style={{ marginTop: 32 }}>
                  Invitations you sent
                </h3>
                <ul className="invitation-card-list">
                  {sentInvites.map((invite) => (
                    <li key={invite.id} className="task-item">
                      <div className="task-card-header">
                        <div className="task-header-text">
                          <span className="task-title">{invite.taskTitle}</span>
                        </div>
                      </div>
                      <div className="task-card-body">
                        <div className="task-card-row">
                          <span className="task-card-label">Invited user</span>
                          <span className="task-card-value">
                            {invite.invitedEmail}
                          </span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Status</span>
                          <span className="task-card-value">
                            {invite.status === "accepted"
                              ? "Accepted"
                              : invite.status === "declined"
                                ? "Declined"
                                : "Pending approval"}
                          </span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        {error && (
          <p className="banner banner-error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
