import { useEffect, useState } from "react";
import type { Task } from "../types/tasks";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";
import { TaskDetailsScreen } from "./TaskDetails/TaskDetailsScreen";
import { useNavigate } from "react-router-dom";

type TaskDetailsModalProps = {
  task: Task;
  isOwner: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onInviteCollaborator: () => void;
};

export function TaskDetailsModal({
  task,
  isOwner,
  onClose,
  onEdit,
  onInviteCollaborator,
}: TaskDetailsModalProps) {
  const navigate = useNavigate();
  const [collaboratorLabels, setCollaboratorLabels] = useState<string[] | null>(
    null,
  );
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [, setComments] = useState<
    { id: string; userLabel: string; text: string; createdAt: string }[]
  >([]);

  const currentUserId = auth.currentUser?.uid ?? null;
  const isSelfCollaborator =
    !!currentUserId &&
    Array.isArray(task.collaborators) &&
    task.collaborators.includes(currentUserId);

  const roleLabel =
    task.isInvited || isSelfCollaborator
      ? "Collaborator"
      : isOwner
        ? "Owner"
        : null;

  // Load collaborators (all users shared on this task)
  useEffect(() => {
    let isMounted = true;

    async function loadCollaborators() {
      const ids = Array.from(new Set(task.collaborators ?? [])).filter(
        (id) => typeof id === "string" && id.length > 0,
      );
      if (ids.length === 0) {
        if (isMounted) {
          setCollaboratorLabels([]);
        }
        return;
      }

      try {
        const labels: string[] = [];
        await Promise.all(
          ids.map(async (uid) => {
            try {
              const ref = doc(collection(db, "profiles"), uid);
              const snap = await getDoc(ref);
              if (!snap.exists()) {
                labels.push(uid);
                return;
              }
              const data = snap.data() as {
                email?: string | null;
                username?: string | null;
              };
              labels.push(data.username ?? data.email ?? uid);
            } catch {
              labels.push(uid);
            }
          }),
        );
        if (!isMounted) return;
        setCollaboratorLabels(labels);
      } catch {
        // ignore loading errors
      }
    }

    void loadCollaborators();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load owner username/email
  useEffect(() => {
    let isMounted = true;

    async function loadOwner() {
      if (!task.ownerId) return;
      try {
        const ref = doc(collection(db, "profiles"), task.ownerId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          if (isMounted) setOwnerLabel(task.ownerId);
          return;
        }
        const data = snap.data() as {
          email?: string | null;
          username?: string | null;
        };
        if (isMounted)
          setOwnerLabel(data.username ?? data.email ?? task.ownerId);
      } catch {
        if (isMounted) setOwnerLabel(task.ownerId);
      }
    }

    void loadOwner();

    return () => {
      isMounted = false;
    };
  }, [task.ownerId]);

  // Realtime comments for this task
  useEffect(() => {
    const q = query(
      collection(db, "task_comments"),
      where("task_id", "==", task.id),
      orderBy("created_at", "asc"),
    );

    const unsub = onSnapshot(q, async (snap) => {
      const items: {
        id: string;
        userLabel: string;
        text: string;
        createdAt: string;
      }[] = [];

      for (const d of snap.docs) {
        const data = d.data() as {
          user_id?: string;
          comment_text?: string;
          created_at?: string;
        };
        let userLabel = data.user_id ?? "Unknown user";
        if (data.user_id) {
          try {
            const pref = doc(collection(db, "profiles"), data.user_id);
            const psnap = await getDoc(pref);
            if (psnap.exists()) {
              const pdata = psnap.data() as {
                email?: string | null;
                username?: string | null;
              };
              userLabel =
                pdata.username ?? pdata.email ?? (data.user_id as string);
            }
          } catch {
            // ignore
          }
        }
        items.push({
          id: d.id,
          userLabel,
          text: data.comment_text ?? "",
          createdAt: data.created_at ?? "",
        });
      }

      setComments(items);
    });

    return () => unsub();
  }, [task.id]);

  return (
    <div
      className="modal-overlay modal-overlay--fullscreen"
      role="dialog"
      aria-modal="true"
    >
      <TaskDetailsScreen
        task={task}
        isOwner={isOwner}
        ownerLabel={ownerLabel}
        roleLabel={roleLabel}
        collaboratorLabels={collaboratorLabels}
        onBack={onClose}
        onEdit={() => onEdit(task)}
        onInviteCollaborator={onInviteCollaborator}
        onOpenComments={() => {
          navigate(`/tasks/${encodeURIComponent(task.id)}/comments`);
        }}
      />
    </div>
  );
}
