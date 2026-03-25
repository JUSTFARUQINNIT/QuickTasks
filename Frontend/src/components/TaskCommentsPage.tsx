import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebaseClient";
import { CommentList } from "./TaskDetails/CommentList";
import { CommentInput } from "./TaskDetails/CommentInput";

type RouteParams = {
  taskId: string;
};

function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "http://localhost:8787";
}

export function TaskCommentsPage() {
  const { taskId } = useParams<RouteParams>();
  const navigate = useNavigate();

  const [taskTitle, setTaskTitle] = useState<string>("Task comments");
  const [comments, setComments] = useState<
    {
      id: string;
      userLabel: string;
      text: string;
      createdAt: string;
      parentId?: string;
      userAvatar?: string;
    }[]
  >([]);
  const [newComment, setNewComment] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    userLabel: string;
  } | null>(null);

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

    console.log("🔧 Setting up comments listener for task:", taskId);

    // Manual fetch on page load as fallback
    const fetchCommentsOnLoad = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          console.log("❌ No user authenticated for manual fetch");
          return;
        }

        console.log("🔑 Getting auth token for manual fetch");
        const token = await user.getIdToken();
        const apiBase = getApiBaseUrl();

        console.log(
          "🌐 Making manual fetch request to:",
          `${apiBase}/api/tasks/${encodeURIComponent(taskId)}/comments`,
        );

        const res = await fetch(
          `${apiBase}/api/tasks/${encodeURIComponent(taskId)}/comments`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        console.log("📡 Manual fetch response:", {
          status: res.status,
          ok: res.ok,
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("❌ Manual fetch failed:", {
            status: res.status,
            errorText,
          });
          return;
        }

        const data = await res.json();
        console.log("📥 Manual fetch on load response:", data);
        // Transform the data to match the frontend format
        const transformedComments = data.comments.map((c: any) => ({
          id: c.id,
          userLabel: c.user?.name || "Unknown user",
          text: c.commentText,
          createdAt: c.createdAt,
          parentId: c.parentId || undefined,
          userAvatar: c.user?.avatarUrl || undefined,
        }));
        setComments(transformedComments);
        console.log("✅ Comments loaded manually:", transformedComments);
      } catch (err) {
        console.error("❌ Manual fetch on load error:", err);
      }
    };

    // Fetch immediately on load
    void fetchCommentsOnLoad();

    // Note: Real-time listener disabled due to Firebase permission issues
    // Manual fetch provides reliable loading and instant updates via optimistic UI
    console.log("📡 Real-time listener disabled - using manual fetch only");

    // Also refresh when page gets focus (user navigates back)
    const handleVisibilityChange = () => {
      if (!document.hidden && taskId) {
        console.log("🔄 Page became visible, refreshing comments");
        void fetchCommentsOnLoad();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
      const apiBase = getApiBaseUrl();

      console.log("🚀 Submitting comment:", {
        taskId,
        commentText: trimmed,
        parentId: replyingTo?.id,
      });

      const res = await fetch(
        `${apiBase}/api/tasks/${encodeURIComponent(taskId)}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            commentText: trimmed,
            parentId: replyingTo?.id,
          }),
        },
      );

      console.log("📡 Comment submission response:", {
        status: res.status,
        ok: res.ok,
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Failed to add comment.");
      }

      const responseData = await res.json();
      console.log("✅ Comment saved successfully:", responseData);

      // Immediately add the new comment to the UI for instant feedback
      const newCommentData = {
        id: responseData.id,
        userLabel:
          auth.currentUser?.displayName || auth.currentUser?.email || "You",
        text: responseData.commentText,
        createdAt: responseData.createdAt,
        parentId: responseData.parentId || undefined,
        userAvatar: auth.currentUser?.photoURL || undefined,
      };

      setComments((prev) =>
        [...prev, newCommentData].sort((a, b) => {
          if (a.createdAt > b.createdAt) return -1;
          if (a.createdAt < b.createdAt) return 1;
          return 0;
        }),
      );

      setNewComment("");
      setReplyingTo(null);

      // Remove the manual fallback since we're updating immediately
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add comment.";
      console.error("❌ Comment submission error:", msg, err);
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
          <CommentList
            comments={comments}
            onReply={(id, userLabel) => setReplyingTo({ id, userLabel })}
          />
          <div style={{ marginTop: 16 }}>
            <CommentInput
              value={newComment}
              onChange={setNewComment}
              onSubmit={handleAddComment}
              loading={commentSaving}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
