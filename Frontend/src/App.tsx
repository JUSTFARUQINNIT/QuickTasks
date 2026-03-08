import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { supabase } from './lib/supabaseClient'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { HiOutlineBell, HiOutlineClipboardDocumentList, HiOutlineCog6Tooth, HiOutlineHome, HiOutlineUserCircle } from 'react-icons/hi2'
import { AuthView } from './components/AuthView'
import { ResetPasswordView } from './components/ResetPasswordView'
import { TasksPage } from './components/TasksPage'
import { ProfilePage } from './components/ProfilePage'
import { CategoriesPage } from './components/CategoriesPage'

type TaskSummary = {
  id: string
  completed: boolean
  due_date: string | null
  created_at: string
  title?: string
}

type TaskForReminder = TaskSummary & { title: string }

function useReminders(userId: string | null) {
  useEffect(() => {
    if (!userId) return

    const inAppEnabled = localStorage.getItem('qt:notification_in_app') === 'true'
    if (!inAppEnabled || !('Notification' in window) || Notification.permission !== 'granted') return

    let isMounted = true
    const todayKey = new Date().toISOString().slice(0, 10)

    async function checkReminders() {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, due_date, completed')
        .eq('user_id', userId)
        .eq('completed', false)
        .not('due_date', 'is', null)

      if (error || !data || !isMounted) return

      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      for (const task of data as TaskForReminder[]) {
        const due = new Date(task.due_date as string)
        if (due > in24h) continue
        const remindedKey = `qt:reminded:${task.id}`
        if (localStorage.getItem(remindedKey) === todayKey) continue
        try {
          const dueStr = due.toLocaleDateString(undefined, { dateStyle: 'medium' })
          new Notification('QuickTasks: Due soon', {
            body: task.title ? `${task.title} is due ${dueStr}` : `Task due ${dueStr}`,
            icon: '/quicktasks-logo.svg',
          })
          localStorage.setItem(remindedKey, todayKey)
        } catch {
          // ignore notification errors
        }
      }
    }

    void checkReminders()
    const interval = window.setInterval(checkReminders, 60 * 60 * 1000) // every hour
    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [userId])
}

function NotificationsPage() {
  const [upcoming, setUpcoming] = useState<{ id: string; title: string; due_date: string }[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) {
        if (isMounted) setLoading(false)
        return
      }
      const { data } = await supabase
        .from('tasks')
        .select('id, title, due_date')
        .eq('user_id', user.id)
        .eq('completed', false)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
      if (!isMounted) return
      const list = (data ?? []).filter((t): t is { id: string; title: string; due_date: string } =>
        t.due_date != null && t.title != null
      )
      const in7Days = new Date()
      in7Days.setDate(in7Days.getDate() + 7)
      setUpcoming(list.filter((t) => new Date(t.due_date) <= in7Days))
      setLoading(false)
    }
    void load()
    return () => { isMounted = false }
  }, [])

  return (
    <div className="notifications-shell">
      <section className="panel-card">
        <header className="panel-header">
          <h2>Upcoming deadlines</h2>
          <span className="panel-pill">Reminders</span>
        </header>
        <p className="panel-body-text">
          Manage how you get reminded in <button type="button" className="panel-link" onClick={() => navigate('/settings')}>Profile</button> (in-app and email).
        </p>
        {loading ? (
          <div className="chart-empty" style={{ minHeight: 120 }}>
            <div className="spinner" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="panel-body-text">No upcoming deadlines in the next 7 days.</p>
        ) : (
          <ul className="reminders-list">
            {upcoming.map((t) => (
              <li key={t.id} className="reminders-item">
                <span className="reminders-title">{t.title}</span>
                <span className="reminders-due">
                  Due {new Date(t.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function DashboardOverview() {
  const [tasks, setTasks] = useState<TaskSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        if (!isMounted) return
        setLoading(true)
        setError(null)

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          if (!isMounted) return
          setTasks([])
          setLoading(false)
          return
        }

        const { data, error: tasksError } = await supabase
          .from('tasks')
          .select('id, completed, due_date, created_at')
          .eq('user_id', user.id)

        if (tasksError) throw tasksError
        if (!isMounted) return
        setTasks((data ?? []) as TaskSummary[])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load dashboard stats.'
        if (!isMounted) return
        setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()

    const intervalId = window.setInterval(() => {
      void load()
    }, 30000)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((t) => t.completed).length
  const overdueTasks = tasks.filter((t) => {
    if (t.completed || !t.due_date) return false
    const due = new Date(t.due_date)
    due.setHours(0, 0, 0, 0)
    return due < today
  }).length
  const pendingTasks = tasks.filter((t) => !t.completed).length - overdueTasks

  const weeklyData = useMemo(() => {
    const byWeek = new Map<string, number>()

    tasks.forEach((task) => {
      if (!task.completed) return
      const created = new Date(task.created_at)
      const year = created.getFullYear()
      const firstJan = new Date(year, 0, 1)
      const days = Math.floor((created.getTime() - firstJan.getTime()) / (24 * 60 * 60 * 1000))
      const week = Math.floor((days + firstJan.getDay()) / 7) + 1
      const key = `${year}-W${week.toString().padStart(2, '0')}`
      byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
    })

    return Array.from(byWeek.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .slice(-8)
      .map(([week, count]) => ({ week, completed: count }))
  }, [tasks])

  const dailyProductivity = useMemo(() => {
    const todayLocal = new Date()
    todayLocal.setHours(0, 0, 0, 0)
    const days: { day: string; completed: number }[] = []

    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(todayLocal)
      d.setDate(todayLocal.getDate() - i)
      const label = d.toLocaleDateString(undefined, { weekday: 'short' })
      const key = d.toISOString().slice(0, 10)

      const completedCount = tasks.filter((task) => {
        if (!task.completed) return false
        const created = new Date(task.created_at)
        const createdKey = created.toISOString().slice(0, 10)
        return createdKey === key
      }).length

      days.push({ day: label, completed: completedCount })
    }

    return days
  }, [tasks])

  return (
    <div className="dashboard-overview">
      <section className="dashboard-grid">
        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Total Tasks</div>
            <span className="stat-trend stat-trend--neutral">Live</span>
          </div>
          <div className="stat-value">{loading ? '—' : totalTasks}</div>
          <div className="stat-meta">{loading ? 'Loading your tasks…' : 'All tasks in your workspace.'}</div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Completed Tasks</div>
            <span className="stat-trend stat-trend--positive">↑</span>
          </div>
          <div className="stat-value">{loading ? '—' : completedTasks}</div>
          <div className="stat-meta">
            {loading ? 'Checking off your wins…' : 'Great work — keep the streak going.'}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Pending Tasks</div>
            <span className="stat-trend stat-trend--neutral">→</span>
          </div>
          <div className="stat-value">{loading ? '—' : Math.max(pendingTasks, 0)}</div>
          <div className="stat-meta">
            {loading ? 'Fetching what is left…' : 'Tasks that are still in progress or upcoming.'}
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-label-row">
            <div className="stat-label">Overdue Tasks</div>
            <span className="stat-trend stat-trend--negative">!</span>
          </div>
          <div className="stat-value">{loading ? '—' : overdueTasks}</div>
          <div className="stat-meta">
            {loading ? 'Reviewing due dates…' : 'Catch up on anything that slipped past its due date.'}
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
                <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.7)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} tickLine={false} stroke="rgba(148,163,184,0.9)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} stroke="rgba(148,163,184,0.9)" />
                  <Tooltip
                    cursor={{ fill: 'rgba(15,23,42,0.8)' }}
                    contentStyle={{
                      background: '#020617',
                      border: '1px solid rgba(51,65,85,0.9)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="completed" radius={[6, 6, 0, 0]} fill="#78d957" />
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
                <LineChart data={dailyProductivity} margin={{ top: 12, right: 12, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51,65,85,0.7)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} stroke="rgba(148,163,184,0.9)" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} stroke="rgba(148,163,184,0.9)" />
                  <Tooltip
                    cursor={{ stroke: '#78d957', strokeWidth: 1 }}
                    contentStyle={{
                      background: '#020617',
                      border: '1px solid rgba(51,65,85,0.9)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    stroke="#78d957"
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 1, stroke: '#bbf7d0', fill: '#020617' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>
    </div>
  )
}

type Profile = {
  id: string
  email: string
  username: string | null
  avatar_url: string | null
  avatar_data: string | null
}

function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  // Always call hooks in the same order; the hook itself handles a null userId.
  useReminders(profile ? profile.id : null)

  useEffect(() => {
    let isMounted = true

    // Detect recovery from URL hash/query as early as possible
    const currentUrl = new URL(window.location.href)
    if (
      currentUrl.searchParams.get('type') === 'recovery' ||
      currentUrl.hash.includes('type=recovery')
    ) {
      setIsRecovery(true)
    }

    async function loadProfileForUser(user: { id: string; email: string | null | undefined }) {
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            email: user.email ?? null,
          },
          { onConflict: 'id' },
        )

        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, username, avatar_url, avatar_data')
          .eq('id', user.id)
          .single()

        if (error) throw error
        if (!isMounted) return
        setProfile(data as Profile)
      } catch {
        if (!isMounted) return
        setProfile({
          id: user.id,
          email: user.email ?? 'Unknown user',
          username: null,
          avatar_url: null,
          avatar_data: null,
        })
      }
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!isMounted) return

      if (session?.user) {
        await loadProfileForUser({ id: session.user.id, email: session.user.email })
      } else {
        setProfile(null)
      }
      setInitializing(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return

      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setInitializing(false)
        return
      }

      if (session?.user) {
        void loadProfileForUser({ id: session.user.id, email: session.user.email })
      } else {
        setProfile(null)
      }
      setInitializing(false)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const storedTheme = (localStorage.getItem('qt:theme') as 'dark' | 'light' | null) ?? null
    document.documentElement.dataset.theme = storedTheme === 'light' ? 'light' : 'dark'

    function syncSidebarToViewport() {
      if (window.innerWidth <= 425) {
        setIsSidebarCollapsed(true)
      }
    }

    syncSidebarToViewport()
    window.addEventListener('resize', syncSidebarToViewport)

    return () => {
      window.removeEventListener('resize', syncSidebarToViewport)
    }
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  function handlePasswordResetDone() {
    setIsRecovery(false)
    setProfile(null)
  }

  if (initializing && !isRecovery) {
    return (
      <div className="loading-shell">
        <div className="spinner" />
      </div>
    )
  }

  if (isRecovery) {
    return <ResetPasswordView onDone={handlePasswordResetDone} />
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/signin" element={<AuthView mode="signin" />} />
        <Route path="/signup" element={<AuthView mode="signup" />} />
        <Route path="/reset-password" element={<ResetPasswordView onDone={handlePasswordResetDone} />} />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    )
  }

  const displayName = profile.username || (profile.email.split('@')[0] ?? profile.email)
  const currentPath = location.pathname

  const currentPageConfig =
    currentPath.startsWith('/tasks/all')
      ? { label: 'All Tasks', icon: <HiOutlineClipboardDocumentList />, path: '/tasks/all' }
      : currentPath.startsWith('/tasks/add')
        ? { label: 'Add Task', icon: <HiOutlineClipboardDocumentList />, path: '/tasks/add' }
        : currentPath.startsWith('/categories')
          ? { label: 'Categories', icon: <HiOutlineClipboardDocumentList />, path: '/categories' }
      : currentPath.startsWith('/settings')
        ? { label: 'Profile', icon: <HiOutlineUserCircle />, path: '/settings' }
        : currentPath.startsWith('/notifications')
          ? { label: 'Notifications', icon: <HiOutlineBell />, path: '/notifications' }
          : { label: 'Dashboard', icon: <HiOutlineHome />, path: '/dashboard' }

  return (
    <div className={`dashboard-shell ${isSidebarCollapsed ? 'dashboard-shell--collapsed' : ''}`}>
      <aside className={`sidebar ${isSidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar-main">
          <button
            type="button"
            className="sidebar-brand"
            onClick={() => {
              navigate('/dashboard')
              if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
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
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineHome />
              </span>
              <span className="sidebar-label">Dashboard</span>
            </NavLink>
            <NavLink
              to="/tasks/add"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineClipboardDocumentList />
              </span>
              <span className="sidebar-label">Add Task</span>
            </NavLink>
            <NavLink
              to="/tasks/all"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineClipboardDocumentList />
              </span>
              <span className="sidebar-label">All Tasks</span>
            </NavLink>
            <NavLink
              to="/categories"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineClipboardDocumentList />
              </span>
              <span className="sidebar-label">Categories</span>
            </NavLink>
            <NavLink
              to="/notifications"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineBell />
              </span>
              <span className="sidebar-label">Notifications</span>
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `sidebar-nav-link ${isActive ? 'is-active' : ''}`}
              onClick={() => {
                if (window.innerWidth <= 425) setIsSidebarCollapsed(true)
              }}
            >
              <span className="sidebar-icon">
                <HiOutlineUserCircle />
              </span>
              <span className="sidebar-label">Profile</span>
            </NavLink>
          </nav>
        </div>

        <button type="button" className="sidebar-logout" onClick={handleSignOut}>
          Log out
        </button>
      </aside>

      {/* <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Close navigation"
        onClick={() => setIsSidebarCollapsed(true)}
      /> */}

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

          {/* <div className="topbar-search">
            <input placeholder="Search tasks..." aria-label="Search tasks" />
          </div> */}

          <div className="topbar-actions">
            <span className="topbar-greeting">Hi, {displayName}</span>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Notifications"
              onClick={() => navigate('/notifications')}
            >
              <HiOutlineBell />
            </button>
            <button
              type="button"
              className="topbar-icon-btn"
              aria-label="Settings"
              onClick={() => navigate('/settings')}
            >
              <HiOutlineCog6Tooth />
            </button>
            <NavLink
              to="/settings"
              className="topbar-avatar"
              aria-label="Profile"
            >
              {profile.avatar_data || profile.avatar_url ? (
                <img src={profile.avatar_data || profile.avatar_url || ''} alt={displayName} />
              ) : (
                <HiOutlineUserCircle />
              )}
            </NavLink>
          </div>
        </header>

        <main className="dashboard-content">
          <Routes>
            <Route path="/dashboard" element={<DashboardOverview />} />
            <Route path="/tasks/add" element={<TasksPage mode="add" />} />
            <Route path="/tasks/all" element={<TasksPage mode="all" />} />
            <Route path="/tasks" element={<Navigate to="/tasks/add" replace />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/settings" element={<ProfilePage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
