import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2'
import { supabase } from '../lib/supabaseClient'

type Priority = 'low' | 'medium' | 'high'

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  completed: boolean
  created_at: string
  category: string | null
}

type EditingState = {
  id: string
  title: string
  description: string
  due_date: string
  priority: Priority
  category: string
} | null

type TasksPageMode = 'add' | 'all' | 'both'

type TasksPageProps = {
  mode?: TasksPageMode
}

export function TasksPage({ mode = 'both' }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<EditingState>(null)

  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all')
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')

  const [availableCategories, setAvailableCategories] = useState<string[]>([])

  const hasTasks = tasks.length > 0

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1
        }
        if (a.due_date && b.due_date) {
          return a.due_date.localeCompare(b.due_date)
        }
        if (a.due_date) return -1
        if (b.due_date) return 1
        return a.created_at.localeCompare(b.created_at)
      }),
    [tasks],
  )

  useEffect(() => {
    let isMounted = true

    try {
      const cached = localStorage.getItem('qt:tasks')
      if (cached) {
        const parsed = JSON.parse(cached) as Task[]
        if (Array.isArray(parsed) && isMounted) {
          setTasks(parsed)
          setLoading(false)
        }
      }
    } catch {
      // ignore cache errors
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          if (!isMounted) return
          setTasks([])
          setAvailableCategories([])
          setLoading(false)
          return
        }

        const [{ data: taskData, error: taskError }, { data: categoryData, error: categoryError }] = await Promise.all([
          supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          supabase.from('categories').select('name').eq('user_id', user.id).order('created_at', { ascending: true }),
        ])

        if (taskError) throw taskError
        if (categoryError) throw categoryError
        if (!isMounted) return
        setTasks((taskData ?? []) as Task[])
        setAvailableCategories(
          Array.from(
            new Set(
              (categoryData ?? [])
                .map((c) => ('name' in c ? String(c.name) : '').trim())
                .filter((value) => value.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b)),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load tasks.'
        if (!isMounted) return
        setError(message)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('qt:tasks', JSON.stringify(tasks))
    } catch {
      // ignore write errors
    }
  }, [tasks])

  function resetForm() {
    setTitle('')
    setDescription('')
    setDueDate('')
    setPriority('medium')
    setCategory('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedCategory = category.trim()

    if (!trimmedTitle) {
      setError('Title is required.')
      return
    }

    if (!trimmedCategory || !dueDate) {
      setError('Category and due date are required.')
      return
    }

    const normalizedDueDate = dueDate || null

    const duplicateTask = tasks.some((task) => {
      const existingDescription = (task.description ?? '').trim()
      const existingCategory = (task.category ?? '').trim()
      const existingDueDate = task.due_date ?? null

      return (
        task.title.trim() === trimmedTitle &&
        existingDescription === trimmedDescription &&
        existingCategory === trimmedCategory &&
        existingDueDate === normalizedDueDate &&
        task.priority === priority
      )
    })

    if (duplicateTask) {
      setError('A task with the same details already exists.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('You must be signed in to manage tasks.')

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: user.id,
          title: trimmedTitle,
          description: trimmedDescription || null,
          due_date: normalizedDueDate,
          priority,
          category: trimmedCategory || null,
        })
        .select()
        .single()

      if (error) throw error
      setTasks((prev) => [data as Task, ...prev])

      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save task.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(task: Task) {
    setEditing({
      id: task.id,
      title: task.title,
      description: task.description ?? '',
      due_date: task.due_date ?? '',
      priority: task.priority,
      category: task.category ?? '',
    })
  }

  async function handleEditSave(e: FormEvent) {
    e.preventDefault()
    if (!editing) return

    const trimmedTitle = editing.title.trim()
    const trimmedDescription = editing.description.trim()
    const trimmedCategory = editing.category.trim()
    const normalizedDueDate = editing.due_date || null

    if (!trimmedTitle) {
      setError('Title is required.')
      return
    }

    const duplicateTask = tasks.some((task) => {
      if (task.id === editing.id) return false

      const existingDescription = (task.description ?? '').trim()
      const existingCategory = (task.category ?? '').trim()
      const existingDueDate = task.due_date ?? null

      return (
        task.title.trim() === trimmedTitle &&
        existingDescription === trimmedDescription &&
        existingCategory === trimmedCategory &&
        existingDueDate === normalizedDueDate &&
        task.priority === editing.priority
      )
    })

    if (duplicateTask) {
      setError('Another task with the same details already exists.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('You must be signed in to manage tasks.')

      const { error } = await supabase
        .from('tasks')
        .update({
          title: trimmedTitle,
          description: trimmedDescription || null,
          due_date: normalizedDueDate,
          priority: editing.priority,
          category: trimmedCategory || null,
        })
        .eq('id', editing.id)
        .eq('user_id', user.id)

      if (error) throw error

      setTasks((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? {
                ...t,
                title: trimmedTitle,
                description: trimmedDescription || null,
                due_date: normalizedDueDate,
                priority: editing.priority,
                category: trimmedCategory || null,
              }
            : t,
        ),
      )

      setEditing(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save task.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleCompleted(task: Task) {
    try {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)))
      const { error } = await supabase
        .from('tasks')
        .update({ completed: !task.completed })
        .eq('id', task.id)
      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update task.'
      setError(message)
      // reload tasks on next mount; for now we won’t roll back immediately
    }
  }

  async function handleDelete(task: Task) {
    const confirmed = window.confirm('Are you sure you want to delete this task? This action cannot be undone.')
    if (!confirmed) return

    try {
      setTasks((prev) => prev.filter((t) => t.id !== task.id))
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) throw error
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete task.'
      setError(message)
    }
  }

  const showAdd = mode === 'add' || mode === 'both'
  const showAll = mode === 'all' || mode === 'both'

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          [
            ...availableCategories,
            ...tasks
              .map((t) => (t.category ?? '').trim())
              .filter((value) => value.length > 0),
          ],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [availableCategories, tasks],
  )

  const filteredTasks = useMemo(() => {
    return sortedTasks.filter((task) => {
      const matchesSearch =
        !search.trim() ||
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        (task.description ?? '').toLowerCase().includes(search.toLowerCase())

      if (!matchesSearch) return false

      if (statusFilter !== 'all') {
        const isOverdue =
          !task.completed &&
          task.due_date !== null &&
          (() => {
            const due = new Date(task.due_date as string)
            due.setHours(0, 0, 0, 0)
            return due < today
          })()

        if (statusFilter === 'completed' && !task.completed) return false
        if (statusFilter === 'pending' && (task.completed || isOverdue)) return false
        if (statusFilter === 'overdue' && !isOverdue) return false
      }

      if (categoryFilter !== 'all') {
        if ((task.category ?? '').trim() !== categoryFilter) return false
      }

      return true
    })
  }, [sortedTasks, search, statusFilter, categoryFilter, today])

  return (
    <div className="tasks-shell tasks-shell--tasks">
      {showAdd && (
        <section className="tasks-panel tasks-form-panel">
          <h2 className="tasks-heading">Add a task</h2>
          <p className="tasks-subtitle">
            Keep today&apos;s priorities clear with a quick, structured task.
          </p>

          <form className="tasks-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What do you need to get done?"
                required
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional details, links, or steps."
                rows={3}
              />
            </label>

            <label className="field">
              <span>Category</span>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Category, e.g. Personal or Work"
                list="task-category-options"
              />
            </label>

            <datalist id="task-category-options">
              {categoryOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>

            <div className="tasks-form-row">
              <label className="field">
                <span>Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </label>

              <label className="field">
                <span>Priority</span>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>

            <div className="tasks-form-actions">
              <button type="submit" className="primary-btn" disabled={saving}>
                {saving ? 'Adding…' : 'Add task'}
              </button>
            </div>
          </form>

          {error && <p className="banner banner-error">{error}</p>}
        </section>
      )}

      {showAll && (
        <section className="tasks-panel tasks-list-panel">
          <div className="tasks-list-header">
            <h2 className="tasks-heading">All tasks</h2>
            <div className="tasks-toolbar">
              <div className="tasks-search">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or description"
                />
              </div>
              <div className="tasks-filters">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="overdue">Overdue</option>
                </select>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
                  disabled={categoryOptions.length === 0}
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="tasks-empty">
              <div className="spinner" />
            </div>
          ) : !hasTasks ? (
            <div className="tasks-empty">
              <p>No tasks yet. Add your first one to get started.</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="tasks-empty">
              <p>No tasks match your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="tasks-table-wrapper">
                <table className="tasks-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                  <th>Category</th>
                  <th>Created</th>
                  <th>Due</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => {
                      const isOverdue =
                        !task.completed &&
                        task.due_date !== null &&
                        (() => {
                          const due = new Date(task.due_date as string)
                          due.setHours(0, 0, 0, 0)
                          return due < today
                        })()

                      const statusLabel = task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'

                      return (
                        <tr key={task.id}>
                          <td>
                            <div className="tasks-table-title">
                              <span>{task.title}</span>
                              {task.description && <p>{task.description}</p>}
                            </div>
                          </td>
                          <td>{task.category ?? '—'}</td>
                          <td>
                            {new Date(task.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </td>
                          <td>
                            {task.due_date
                              ? new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })
                              : '—'}
                          </td>
                          <td>
                            {task.priority && (
                              <span className={`task-pill task-pill--${task.priority}`}>{task.priority}</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`task-status task-status--${
                                task.completed ? 'completed' : isOverdue ? 'overdue' : 'pending'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </td>
                          <td className="tasks-table-actions">
                            <button
                              type="button"
                              className="task-action-btn"
                              onClick={() => startEdit(task)}
                              aria-label="Edit task"
                              title="Edit task"
                            >
                              <HiOutlinePencilSquare />
                            </button>
                            <button
                              type="button"
                              className="task-action-btn"
                              onClick={() => void toggleCompleted(task)}
                            >
                              {task.completed ? 'Undo' : 'Complete'}
                            </button>
                            <button
                              type="button"
                              className="task-action-btn task-action-btn--danger"
                              onClick={() => void handleDelete(task)}
                              aria-label="Delete task"
                              title="Delete task"
                            >
                              <HiOutlineTrash />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="tasks-card-list">
                {filteredTasks.map((task) => {
                  const isOverdue =
                    !task.completed &&
                    task.due_date !== null &&
                    (() => {
                      const due = new Date(task.due_date as string)
                      due.setHours(0, 0, 0, 0)
                      return due < today
                    })()

                  const statusLabel = task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Pending'

                  return (
                    <li key={task.id} className={`task-item ${task.completed ? 'task-item--done' : ''}`}>
                      <div className="task-main">
                        <button
                          type="button"
                          className={`task-check ${task.completed ? 'task-check--checked' : ''}`}
                          onClick={() => void toggleCompleted(task)}
                          aria-label={task.completed ? 'Mark as not completed' : 'Mark as completed'}
                        />
                        <div className="task-text">
                          <div className="task-title-row">
                            <span className="task-title">{task.title}</span>
                            {task.priority && (
                              <span className={`task-pill task-pill--${task.priority}`}>{task.priority}</span>
                            )}
                          </div>
                          {task.description && <p className="task-description">{task.description}</p>}
                          <div className="task-meta">
                            {task.category && <span className="task-meta-category">{task.category}  </span>}
                            <div className="date">
                            <span className="task-meta-created">
                              Created:{' '}
                              {new Date(task.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                            ---
                            {task.due_date && (
                              <>
                                {'  '}
                                <span>
                                  Due{' '}
                                  {new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                                </span>
                              </>
                            )}
                            </div>
                          </div>
                          <p className="task-meta">
                            <span
                              className={`task-status task-status--${
                                task.completed ? 'completed' : isOverdue ? 'overdue' : 'pending'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="task-actions" style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                        <button
                          type="button"
                          className="task-action-btn"
                          onClick={() => startEdit(task)}
                          aria-label="Edit task"
                          title="Edit task"
                        >
                          <HiOutlinePencilSquare />
                        </button>
                        <button
                          type="button"
                          className="task-action-btn"
                          onClick={() => void toggleCompleted(task)}
                        >
                          {task.completed ? 'Undo' : 'Complete'}
                        </button>
                        <button
                          type="button"
                          className="task-action-btn task-action-btn--danger"
                          onClick={() => void handleDelete(task)}
                          aria-label="Delete task"
                          title="Delete task"
                        >
                          <HiOutlineTrash />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </section>
      )}

      {editing && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card">
            <h2 className="modal-title">Edit task</h2>
            <p className="modal-subtitle">Update the details for this task.</p>
            <form className="tasks-form" onSubmit={handleEditSave}>
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  value={editing.title}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            title: e.target.value,
                          }
                        : prev,
                    )
                  }
                  required
                />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea
                  value={editing.description}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            description: e.target.value,
                          }
                        : prev,
                    )
                  }
                  rows={3}
                />
              </label>

              <label className="field">
                <span>Category</span>
                <input
                  type="text"
                  value={editing.category}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? {
                            ...prev,
                            category: e.target.value,
                          }
                        : prev,
                    )
                  }
                />
              </label>

              <div className="tasks-form-row">
                <label className="field">
                  <span>Due date</span>
                  <input
                    type="date"
                    value={editing.due_date}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              due_date: e.target.value,
                            }
                          : prev,
                      )
                    }
                  />
                </label>

                <label className="field">
                  <span>Priority</span>
                  <select
                    value={editing.priority}
                    onChange={(e) =>
                      setEditing((prev) =>
                        prev
                          ? {
                              ...prev,
                              priority: e.target.value as Priority,
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
              </div>

              <div className="tasks-form-actions">
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? 'Saving changes…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  className="ghost-btn tasks-cancel-btn"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

