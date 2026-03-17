import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { CommentList } from "./TaskDetails/CommentList";
import { CommentInput } from "./TaskDetails/CommentInput";

type RouteParams = {
  taskId: string;
};

export function TaskCommentsPage() {
  const { taskId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [taskTitle, setTaskTitle] = useState<string>("Task comments");
  const [comments, setComments] = useState<
    { id: string; userLabel: string; text: string; createdAt: string }[]
  >([]);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const ref = doc(db, "tasks", taskId);
    void getDoc(ref)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as { title?: string };
        if (data.title) setTaskTitle(data.title);
      })
      .catch(() => {
        // ignore
      });
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    const q = query(
      collection(db, "task_comments"),
      where("task_id", "==", taskId),
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
  }, [taskId]);

  async function handleAddComment() {
    const trimmed = newComment.trim();
    if (!trimmed || !taskId) return;
    const user = auth.currentUser;
    if (!user) {
      console.error("You must be signed in to comment.");
      return;
    }
    setCommentSaving(true);
    try {
      const token = await user.getIdToken();
      const apiBase = import.meta.env.VITE_API_BASE_URL;

      const res = await fetch(
        `${apiBase}/api/tasks/${encodeURIComponent(taskId)}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ commentText: trimmed }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "Failed to add comment.");
      }
      setNewComment("");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Could not add comment.";
      console.error(msg);
    } finally {
      setCommentSaving(false);
    }
  }

  return (
    <div className="tasks-shell tasks-shell--tasks">
      <section className="tasks-panel tasks-list-panel">
        <div className="tasks-lists-header">
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate(-1)}
          >
            ←
          </button>
          <div>
            <p className="task-subtitle">
              Discussion for <span className="highlight">{taskTitle}</span>
            </p>
          </div>
        </div>

        <div className="task-details-comments-page">
          <CommentList comments={comments} />
          <div style={{ marginTop: 16 }}>
            <CommentInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={handleAddComment}
              loading={commentSaving}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

