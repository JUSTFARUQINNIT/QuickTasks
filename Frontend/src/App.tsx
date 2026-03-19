import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import { auth, db } from "./lib/firebaseClient";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { Task } from "./types/tasks";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  // Firestore,
} from "firebase/firestore";
import { calculateTaskCompletion } from "./utils/taskCompletion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HiOutlineBell,
  HiOutlineClipboardDocumentList,
  HiPlus,
  HiArrowLeftOnRectangle,
  HiOutlineSquares2X2,
  HiOutlineHome,
  HiOutlineUserCircle,
  HiOutlineUserPlus,
} from "react-icons/hi2";
import { AuthView } from "./components/AuthView";
import { ResetPasswordView } from "./components/ResetPasswordView";
import { TasksPage } from "./components/TasksPage";
import { ProfilePage } from "./components/ProfilePage";
import { CategoriesPage } from "./components/CategoriesPage";
import { InvitationsPage } from "./components/InvitationsPage";
import { TaskCommentsPage } from "./components/TaskCommentsPage";

type TaskSummary = {
  id: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
  completed_at?: string | null;
  title?: string;
  subtasks?: any[];
};

type TaskForReminder = TaskSummary & { title: string };

function useReminders(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    const inAppEnabled =
      localStorage.getItem("qt:notification_in_app") === "true";
    if (
      !inAppEnabled ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;

    let isMounted = true;
    const todayKey = new Date().toISOString().slice(0, 10);

    async function checkReminders() {
      try {
        const q = query(
          collection(db, "tasks"),
          where("user_id", "==", userId),
          where("completed", "==", false),
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;
        const data = snapshot.docs
          .map((d) => ({ id: d.id, ...(d.data() as Partial<TaskForReminder>) }))
          .filter((t): t is TaskForReminder => !!t.due_date);

        const now = new Date();
        const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        for (const task of data as TaskForReminder[]) {
          const due = new Date(task.due_date as string);
          if (due > in24h) continue;
          const remindedKey = `qt:reminded:${task.id}`;
          if (localStorage.getItem(remindedKey) === todayKey) continue;
          try {
            const dueStr = due.toLocaleDateString(undefined, {
              dateStyle: "medium",
            });
            new Notification("QuickTasks: Due soon", {
              body: task.title
                ? `${task.title} is due ${dueStr}`
                : `Task due ${dueStr}`,
              icon: "/quicktasks-logo.svg",
            });
            localStorage.setItem(remindedKey, todayKey);
          } catch {
            // ignore notification errors
          }
        }
      } catch {
        // ignore reminder loading errors
      }
    }

    void checkReminders();
    const interval = window.setInterval(checkReminders, 60 * 60 * 1000); // every hour
    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [userId]);
}

function NotificationsPage() {
  const [upcoming, setUpcoming] = useState<
    { id: string; title: string; due_date: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const user = auth.currentUser;
      if (!user || !isMounted) {
        if (isMounted) setLoading(false);
        return;
      }
      const q = query(
        collection(db, "tasks"),
        where("user_id", "==", user.uid),
        where("completed", "==", false),
      );
      const snapshot = await getDocs(q);
      if (!isMounted) return;
      const list = snapshot.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as { title?: string; due_date?: string | null }),
        }))
        .filter(
          (t): t is { id: string; title: string; due_date: string } =>
            t.due_date != null && t.title != null,
        );
      const in7Days = new Date();
      in7Days.setDate(in7Days.getDate() + 7);
      setUpcoming(list.filter((t) => new Date(t.due_date) <= in7Days));
      setLoading(false);
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="notifications-shell">
      <section className="panel-card">
        <header className="panel-header">
          <h2>Upcoming deadlines</h2>
          <span className="panel-pill">Reminders</span>
        </header>
        <p className="panel-body-text">
          Manage how you get reminded in{" "}
          <button
            type="button"
            className="panel-link"
            onClick={() => navigate("/settings")}
          >
            Profile
          </button>{" "}
          (in-app and email).
        </p>
        {loading ? (
          <div className="chart-empty" style={{ minHeight: 120 }}>
            <div className="spinner" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="panel-body-text">
            No upcoming deadlines in the next 7 days.
          </p>
        ) : (
          <ul className="reminders-list">
            {upcoming.map((t) => (
              <li key={t.id} className="reminders-item">
                <span className="reminders-title">{t.title}</span>
                <span className="reminders-due">
                  Due{" "}
                  {new Date(t.due_date).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DashboardOverview() {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        if (!isMounted) return;
        setLoading(true);
        setError(null);

        const user = auth.currentUser;
        if (!user) {
          if (!isMounted) return;
          setTasks([]);
          setLoading(false);
          return;
        }

        // Fetch tasks exactly like TasksPage - both owned and invited
        const ownerQuery = query(collection(db, "tasks"), where("user_id", "==", user.uid));
        
        // Also query for tasks where user is a collaborator (to catch any tasks that might be structured differently)
        let collaboratorResult;
        try {
          const collaboratorQuery = query(collection(db, "tasks"), where("collaborators", "array-contains", user.uid));
          collaboratorResult = await getDocs(collaboratorQuery);
        } catch (collabError) {
          console.warn("Collaborator query failed, using fallback:", collabError);
          collaboratorResult = { docs: [] }; // Empty fallback
        }
        
        // Also query for shared tasks where user is a collaborator (accepted invitations)
        let sharedSnap;
        try {
          // First try to get tasks where user is explicitly in collaborators array
          const collaboratorSharedQuery = query(collection(db, "tasks"), 
            where("shared", "==", true),
            where("collaborators", "array-contains", user.uid)
          );
          sharedSnap = await getDocs(collaboratorSharedQuery);
        } catch (sharedError) {
          console.warn("Shared query failed, using fallback:", sharedError);
          
          // Alternative approach: Get all shared tasks and filter for ones where user is in collaborators
          try {
            const allSharedTasksQuery = query(collection(db, "tasks"), where("shared", "==", true));
            const allSharedTasks = await getDocs(allSharedTasksQuery);
            
            // Filter for shared tasks where user is explicitly in collaborators
            const sharedWithUser = allSharedTasks.docs.filter(doc => {
              const data = doc.data();
              return data.collaborators && 
                     Array.isArray(data.collaborators) && 
                     data.collaborators.includes(user.uid);
            });
            
            sharedSnap = { docs: sharedWithUser };
            console.log("✅ Alternative shared query found tasks where user is collaborator:", sharedWithUser.length);
          } catch (altError) {
            console.warn("Alternative shared query also failed:", altError);
            sharedSnap = { docs: [] }; // Empty fallback
          }
        }
        
        const invitedTasksQuery = collection(db, "userTasks", user.uid, "tasks");

        const [ownerSnap, invitedSnap] = await Promise.all([
          getDocs(ownerQuery),
          getDocs(invitedTasksQuery),
        ]);
        if (!isMounted) return;

        // Process invited tasks exactly like TasksPage
        const invitedTasks = await Promise.all(
          invitedSnap.docs.map(async (invitedDoc) => {
            const invitedData = invitedDoc.data();
            const masterId = invitedDoc.id;

            // Try to fetch the master task to get complete data
            try {
              const masterDoc = await getDoc(doc(db, "tasks", masterId));
              if (masterDoc.exists()) {
                const masterData = masterDoc.data();
                // Merge master data with invited data, ensuring all fields are present
                return {
                  id: masterId,
                  data: {
                    ...masterData,
                    // Ensure these fields are properly set for invited tasks
                    isInvited: true,
                    ref: masterId,
                    // Ensure subtasks and attachments are included
                    subtasks: masterData.subtasks || [],
                    attachments: masterData.attachments || [],
                    collaborators: masterData.collaborators || [],
                    shared: masterData.shared || false,
                    completed: masterData.completed || false,
                    // Keep invited-specific fields
                    invitedAt: invitedData.invitedAt,
                    invitedBy: invitedData.invitedBy,
                  }
                };
              }
            } catch (err) {
              // Handle permission errors gracefully - use invited data instead
              if (err instanceof Error && err.message.includes('Missing or insufficient permissions')) {
                console.log(`Permission denied for master task ${masterId}, using invited data`);
              } else {
                console.warn(
                  `Could not fetch master task ${masterId}, using invited data:`,
                  err,
                );
              }
            }

            // Fallback to invited data if master fetch fails (including permission errors)
            return {
              id: masterId,
              data: {
                ...invitedData,
                isInvited: true,
                ref: masterId,
                // Ensure arrays are properly initialized
                subtasks: invitedData.subtasks || [],
                attachments: invitedData.attachments || [],
                collaborators: invitedData.collaborators || [],
                shared: invitedData.shared || false,
                completed: invitedData.completed || false,
              }
            };
          })
        );

        // Process collaborator query results
        const collaboratorTasks = collaboratorResult.docs.map((doc) => ({ 
          id: doc.id, 
          data: doc.data() as any
        }));

        // Process shared query results
        const sharedTasks = sharedSnap.docs.map((doc) => ({ 
          id: doc.id, 
          data: doc.data() as any
        }));

        console.log("Dashboard query details:", {
          ownerTasks: ownerSnap.docs.length,
          collaboratorTasks: collaboratorResult.docs.length,
          sharedTasks: sharedSnap.docs.length,
          invitedTasks: invitedSnap.docs.length,
          totalTasks: ownerSnap.docs.length + collaboratorResult.docs.length + sharedSnap.docs.length + invitedSnap.docs.length
        });

        // Debug: Show which queries found data
        if (ownerSnap.docs.length > 0) {
          console.log("✅ Owner query found tasks:", ownerSnap.docs.length);
        }
        if (collaboratorResult.docs.length > 0) {
          console.log("✅ Collaborator query found tasks:", collaboratorResult.docs.length);
        }
        if (sharedSnap.docs.length > 0) {
          console.log("✅ Shared query found tasks:", sharedSnap.docs.length);
        }
        if (invitedSnap.docs.length > 0) {
          console.log("✅ Invited query found tasks:", invitedSnap.docs.length);
        }

        console.log("Dashboard query results:", {
          ownerTasks: ownerSnap.docs.length,
          collaboratorTasks: collaboratorResult.docs.length,
          invitedTasks: invitedSnap.docs.length
        });

        // Combine all task data exactly like TasksPage - ensure consistent { id, data } structure
        const allTasks = [
          ...ownerSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() })),
          ...collaboratorTasks,
          ...sharedTasks,
          ...invitedTasks,
        ];

        // Debug: Log task structure
        console.log("Task structure sample:", allTasks[0]);

        // Remove duplicates (tasks might appear in multiple queries)
        const uniqueTasks = allTasks.filter((task, index, self) => 
          index === self.findIndex((t) => t.id === task.id)
        );

        // Utility function to safely extract user_id from task data
        const getOwnerId = (data: any): string | null => {
          if (!data) return null;
          return data.user_id || data.ownerId || null;
        };

        // Process tasks exactly like TasksPage to ensure consistency
        const processedTasks = uniqueTasks
          .map((task: any): Task | null => {
            try {
              const { id, data } = task;
              if (!data) {
                console.warn("Task with undefined data:", task);
                return null;
              }
              const ownerId = getOwnerId(data);
              const isInvited = (data as any).isInvited === true;
              return {
                id,
                ...data,
                shared: ownerId !== user.uid,
                ownerId: ownerId,
                isInvited,
                ref: ((data as any).ref as string | undefined) ?? id,
              };
            } catch (error) {
              console.warn("Error processing task:", task, error);
              return null;
            }
          })
          .filter((t): t is Task => t !== null);

        setTasks(processedTasks);
        console.log("Dashboard loaded tasks:", processedTasks.length);
        console.log("Completed tasks:", processedTasks.filter(t => calculateTaskCompletion(t)).length);
      } catch (err) {
        console.error("Dashboard data loading error:", err);
        const errorMessage =
          err instanceof Error ? err.message : typeof err === "string" ? err : "";
        console.error("Error details:", {
          message: errorMessage,
          code: (err as any)?.code,
          stack: err instanceof Error ? err.stack : undefined,
        });
        const message =
          err instanceof Error
            ? err.message
            : "Could not load dashboard stats.";
        if (!isMounted) return;
        setError(message);
        console.log("Dashboard error set:", message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    const intervalId = window.setInterval(() => {
      void load();
    }, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => calculateTaskCompletion(t)).length;
  const overdueTasks = tasks.filter((t) => {
    if (calculateTaskCompletion(t) || !t.due_date) return false;
    const due = new Date(t.due_date);
    due.setHours(0, 0, 0, 0);
    return due < today;
  }).length;
  const pendingTasks = tasks.filter((t) => !calculateTaskCompletion(t)).length - overdueTasks;

  console.log("Dashboard stats:", { totalTasks, completedTasks, overdueTasks, pendingTasks });

  // Ensure we have valid numbers even if data is loading
  const displayTasks = Math.max(0, totalTasks);
  const displayCompleted = Math.max(0, completedTasks);
  const displayOverdue = Math.max(0, overdueTasks);
  const displayPending = Math.max(0, pendingTasks);

  const weeklyData = useMemo(() => {
    const byWeek = new Map<string, number>();

    tasks.forEach((task) => {
      if (!calculateTaskCompletion(task)) return;
      const created = new Date(task.created_at);
      const year = created.getFullYear();
      const firstJan = new Date(year, 0, 1);
      const days = Math.floor(
        (created.getTime() - firstJan.getTime()) / (1000 * 60 * 60 * 24),
      );
      const week = Math.floor(days / 7);
      const key = `${year}-W${week}`;
      byWeek.set(key, (byWeek.get(key) || 0) + 1);
    });

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-8)
      .map(([week, count]) => ({ week, completed: count }));
  }, [tasks]);

  const dailyProductivity = useMemo(() => {
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    const days: { day: string; completed: number }[] = [];

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(todayLocal);
      d.setDate(todayLocal.getDate() - i);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      const key = d.toISOString().slice(0, 10);

      const completedCount = tasks.filter((task) => {
        if (!calculateTaskCompletion(task)) return false;
        const doneAt = task.completed_at ?? task.created_at;
        const doneKey = new Date(doneAt).toISOString().slice(0, 10);
        return doneKey === key;
      }).length;

      days.push({ day: label, completed: completedCount });
    }

    return days;
  }, [tasks]);

  return (
    <div className="dashboard-overview">
      <section className="dashboard-grid">
        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Total Tasks</div>
            <span className="stat-trend stat-trend--neutral">Live</span>
          </div>
          <div className="stat-value">{loading ? "—" : displayTasks}</div>
          <div className="stat-meta">
            {loading ? "Loading your tasks…" : "All tasks in your workspace."}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Completed Tasks</div>
            <span className="stat-trend stat-trend--positive">↑</span>
          </div>
          <div className="stat-value">{loading ? "—" : displayCompleted}</div>
          <div className="stat-meta">
            {loading
              ? "Checking off your wins…"
              : "Great work — keep the streak going."}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Pending Tasks</div>
            <span className="stat-trend stat-trend--neutral">→</span>
          </div>
          <div className="stat-value">
            {loading ? "—" : Math.max(displayPending, 0)}
          </div>
          <div className="stat-meta">
            {loading
              ? "Fetching what is left…"
              : "Tasks that are still in progress or upcoming."}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Overdue Tasks</div>
            <span className="stat-trend stat-trend--negative">!</span>
          </div>
          <div className="stat-value">{loading ? "—" : displayOverdue}</div>
          <div className="stat-meta">
            {loading
              ? "Reviewing due dates…"
              : "Catch up on anything that slipped past its due date."}
          </div>
        </article>
      </section>

      <section className="dashboard-secondary">
        <article className="panel-card">
          <header className="panel-header">
            <h2>Tasks Completed Per Week</h2>
            <span className="panel-pill">Last 8 weeks</span>
          </header>
          <div className="chart-wrapper">
            {loading ? (
              <div className="chart-empty">
                <div className="spinner" />
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="chart-empty">
                <p>No completed tasks yet to chart.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={weeklyData}
                  margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(51,65,85,0.7)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    stroke="rgba(148,163,184,0.9)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    stroke="rgba(148,163,184,0.9)"
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(15,23,42,0.8)" }}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(51,65,85,0.9)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="completed"
                    radius={[6, 6, 0, 0]}
                    fill="#78d957"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {error && <p className="banner banner-error">{error}</p>}
        </article>

        <article className="panel-card">
          <header className="panel-header">
            <h2>Productivity Trend</h2>
            <span className="panel-pill">Last 7 days</span>
          </header>
          <div className="chart-wrapper">
            {loading ? (
              <div className="chart-empty">
                <div className="spinner" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={dailyProductivity}
                  margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(51,65,85,0.7)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    stroke="rgba(148,163,184,0.9)"
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    stroke="rgba(148,163,184,0.9)"
                  />
                  <Tooltip
                    cursor={{ stroke: "#78d957", strokeWidth: 1 }}
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(51,65,85,0.9)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#78d957"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      strokeWidth: 1,
                      stroke: "#bbf7d0",
                      fill: "#020617",
                    }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

type Profile = {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  avatar_data: string | null;
};

function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Always call hooks in the same order; the hook itself handles a null userId.
  useReminders(profile ? profile.id : null);

  useEffect(() => {
    let isMounted = true;

    // Detect custom reset-password links as early as possible
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("token")) {
      setIsRecovery(true);
    }

    async function loadProfileForUser(user: User) {
      try {
        const ref = doc(collection(db, "profiles"), user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, {
            email: user.email ?? null,
            username: null,
            avatar_url: null,
            avatar_data: null,
          });
          if (!isMounted) return;
          setProfile({
            id: user.uid,
            email: user.email ?? "Unknown user",
            username: null,
            avatar_url: null,
            avatar_data: null,
          });
          return;
        }

        if (!isMounted) return;
        const data = snap.data() as Omit<Profile, "id">;
        setProfile({
          id: user.uid,
          email: data.email,
          username: data.username,
          avatar_url: data.avatar_url,
          avatar_data: data.avatar_data,
        });
      } catch {
        if (!isMounted) return;
        setProfile({
          id: user.uid,
          email: user.email ?? "Unknown user",
          username: null,
          avatar_url: null,
          avatar_data: null,
        });
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) return;

      const url = new URL(window.location.href);
      const modeParam = url.searchParams.get("mode");
      const oobCode = url.searchParams.get("oobCode");

      if (modeParam === "resetPassword" && oobCode) {
        setIsRecovery(true);
        setInitializing(false);
        return;
      }

      if (user) {
        void loadProfileForUser(user);
      } else {
        setProfile(null);
      }
      setInitializing(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const storedTheme =
      (localStorage.getItem("qt:theme") as "dark" | "light" | null) ?? null;
    document.documentElement.dataset.theme =
      storedTheme === "light" ? "light" : "dark";

    function syncSidebarToViewport() {
      // On small screens, default to the sidebar being hidden (drawer closed).
      // On larger screens, keep the sidebar visible so navigation is always accessible.
      setIsSidebarCollapsed(window.innerWidth <= 640);
    }

    syncSidebarToViewport();
    window.addEventListener("resize", syncSidebarToViewport);

    return () => {
      window.removeEventListener("resize", syncSidebarToViewport);
    };
  }, []);

  async function handleSignOut() {
    await signOut(auth);
  }

  async function handlePasswordResetDone() {
    await signOut(auth);
    setIsRecovery(false);
    setProfile(null);
  }

  if (initializing && !isRecovery) {
    return (
      <div className="loading-shell">
        <div className="spinner" />
      </div>
    );
  }

  if (isRecovery) {
    return <ResetPasswordView onDone={handlePasswordResetDone} />;
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/signin" element={<AuthView mode="signin" />} />
        <Route path="/signup" element={<AuthView mode="signup" />} />
        <Route
          path="/reset-password"
          element={<ResetPasswordView onDone={handlePasswordResetDone} />}
        />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    );
  }

  const displayName =
    profile.username || (profile.email.split("@")[0] ?? profile.email);
  const currentPath = location.pathname;

  const currentPageConfig = currentPath.startsWith("/tasks/all")
    ? {
        label: "All Tasks",
        icon: <HiOutlineClipboardDocumentList />,
        path: "/tasks/all",
      }
    : currentPath.startsWith("/tasks/add")
      ? {
          label: "Add Task",
          icon: <HiOutlineClipboardDocumentList />,
          path: "/tasks/add",
        }
      : currentPath.startsWith("/categories")
        ? {
            label: "Categories",
            icon: <HiOutlineClipboardDocumentList />,
            path: "/categories",
          }
        : currentPath.startsWith("/settings")
          ? {
              label: "Profile",
              icon: <HiOutlineUserCircle />,
              path: "/settings",
            }
          : currentPath.startsWith("/notifications")
            ? {
                label: "Notifications",
                icon: <HiOutlineBell />,
                path: "/notifications",
              }
            : currentPath.startsWith("/invitations")
              ? {
                  label: "Invitations",
                  icon: <HiOutlineBell />,
                  path: "/invitations",
                }
              : {
                  label: "Dashboard",
                  icon: <HiOutlineHome />,
                  path: "/dashboard",
                };

  return (
    <div
      className={`dashboard-shell ${isSidebarCollapsed ? "dashboard-shell--collapsed" : ""}`}
    >
      <aside
        className={`sidebar ${isSidebarCollapsed ? "sidebar--collapsed" : ""}`}
      >
        <div className="sidebar-main">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => {
              navigate("/dashboard");
              if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
            }}
          >
            <span className="sidebar-brand-mark">
              <img src="/quicktasks-logo.svg" alt="QuickTasks logo" />
            </span>
            <span className="sidebar-brand-text">QuickTasks</span>
          </button>

          <nav className="sidebar-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineHome />
              </span>
              <span className="sidebar-label">Dashboard</span>
            </NavLink>
            <NavLink
              to="/tasks/add"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiPlus />
              </span>
              <span className="sidebar-label">Add Task</span>
            </NavLink>
            <NavLink
              to="/tasks/all"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineClipboardDocumentList />
              </span>
              <span className="sidebar-label">All Tasks</span>
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineSquares2X2 />
              </span>
              <span className="sidebar-label">Categories</span>
            </NavLink>
            <NavLink
              to="/invitations"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineUserPlus />
              </span>
              <span className="sidebar-label">Invitations</span>
            </NavLink>
            <NavLink
              to="/notifications"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineBell />
              </span>
              <span className="sidebar-label">Notifications</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `sidebar-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => {
                if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineUserCircle />
              </span>
              <span className="sidebar-label">Profile</span>
            </NavLink>
          </nav>
        </div>
        <button
          type="button"
          className={`sidebar-nav-link sidebar-logout ${isSidebarCollapsed ? "collapsed" : ""}`}
          onClick={() => {
            handleSignOut();
            if (window.innerWidth <= 640) setIsSidebarCollapsed(true);
          }}
        >
          <span className="sidebar-icon">
            <HiArrowLeftOnRectangle />
          </span>
          {!isSidebarCollapsed && (
            <span className="sidebar-label">Log out</span>
          )}
        </button>
      </aside>

      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setIsSidebarCollapsed(true)}
      />

      <div className="dashboard-main">
        <header className="topbar">
          <button
            type="button"
            className="topbar-menu-btn"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            <span className="topbar-menu-icon" />
          </button>

          <NavLink to={currentPageConfig.path} className="topbar-home">
            <span className="topbar-home-icon">{currentPageConfig.icon}</span>
            <span className="topbar-home-label">{currentPageConfig.label}</span>
          </NavLink>

          <div className="topbar-spacer" />

          <div className="topbar-actions">
            <span className="topbar-greeting">Hi, {displayName}</span>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate("/notifications")}
            >
              <HiOutlineBell />
            </button>

            <NavLink
              to="/settings"
              className="topbar-avatar"
              aria-label="Profile"
            >
              {profile.avatar_data || profile.avatar_url ? (
                <img
                  src={profile.avatar_data || profile.avatar_url || ""}
                  alt={displayName}
                />
              ) : (
                <HiOutlineUserCircle />
              )}
            </NavLink>
          </div>
        </header>

        <main className="dashboard-content">
          <ErrorBoundary>
            <Routes>
              <Route path="/dashboard" element={<DashboardOverview />} />
              <Route path="/tasks/add" element={<TasksPage mode="add" />} />
              <Route path="/tasks/all" element={<TasksPage mode="all" />} />
              <Route
                path="/tasks/:taskId/comments"
                element={<TaskCommentsPage />}
              />
              <Route
                path="/tasks"
                element={<Navigate to="/tasks/add" replace />}
              />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/settings" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/invitations" element={<InvitationsPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default App;
