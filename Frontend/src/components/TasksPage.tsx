import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { HiOutlinePencilSquare, HiOutlineTrash } from 'react-icons/hi2'
import { auth, db } from '../lib/firebaseClient'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore'
import { enqueueOfflineAction, readCachedTasks, readOfflineQueue, writeCachedTasks, writeOfflineQueue } from '../lib/offlineTasks'

type Priority = 'low' | 'medium' | 'high'

type Task = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  completed: boolean
  created_at: string
  completed_at?: string | null
  category: string | null
  order: number
  assigned_to?: string | null
  assigned_email?: string | null
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
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))
  const [isSyncing, setIsSyncing] = useState(false)
  const syncInFlight = useRef(false)

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
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)
  const [assignSaving, setAssignSaving] = useState(false)

  const hasTasks = tasks.length > 0

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1
        }
        // Primary ordering is user-controlled drag-and-drop order.
        const orderDiff = (a.order ?? 0) - (b.order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return a.created_at.localeCompare(b.created_at)
      }),
    [tasks],
  )

  const canReorder = useMemo(() => {
    return search.trim().length === 0 && statusFilter === 'all' && categoryFilter === 'all'
  }, [search, statusFilter, categoryFilter])

  useEffect(() => {
    let isMounted = true

    try {
      const cached = readCachedTasks<Task>()
      if (cached.length > 0 && isMounted) {
        setTasks(cached)
        setLoading(false)
      }
    } catch {
      // ignore cache errors
    }

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const user = auth.currentUser
        if (!user) {
          if (!isMounted) return
          setTasks([])
          setAvailableCategories([])
          setLoading(false)
          return
        }

        if (!navigator.onLine) {
          // Offline: rely on cached_tasks (set above). Keep UX responsive.
          if (!isMounted) return
          setLoading(false)
          return
        }

        const tasksQuery = query(collection(db, 'tasks'), where('user_id', '==', user.uid), orderBy('order', 'asc'))
        const legacyTasksQuery = query(
          collection(db, 'tasks'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'desc'),
        )
        const categoriesQuery = query(
          collection(db, 'categories'),
          where('user_id', '==', user.uid),
          orderBy('created_at', 'asc'),
        )

        const [tasksSnapshot, categoriesSnapshot] = await Promise.all([
          (async () => {
            try {
              return await getDocs(tasksQuery)
            } catch {
              // Backward compatible: if the composite index for (user_id, order) is missing,
              // fall back to created_at so the page still loads.
              return await getDocs(legacyTasksQuery)
            }
          })(),
          getDocs(categoriesQuery),
        ])

        if (!isMounted) return

        const taskData = tasksSnapshot.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }))
        const categoryData = categoriesSnapshot.docs.map((d) => d.data() as { name?: string | null })

        const hasAnyMissingOrder = (taskData as Array<Record<string, unknown>>).some((t) => typeof t.order !== 'number')

        const normalizedTasks = (taskData as Task[]).map((t) => ({
          ...t,
          order: typeof t.order === 'number' ? t.order : 0,
        }))

        const nextTasks = hasAnyMissingOrder
          ? // First-time migration: preserve existing behavior (newest first) by assigning
            // a sequential order based on created_at descending.
            [...normalizedTasks]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((t, idx) => ({ ...t, order: idx + 1 }))
          : normalizedTasks

        setTasks(nextTasks)
        writeCachedTasks(nextTasks)
        setAvailableCategories(
          Array.from(
            new Set(
              (categoryData ?? [])
                .map((c) => ('name' in c ? String(c.name ?? '') : '').trim())
                .filter((value) => value.length > 0),
            ),
          ).sort((a, b) => a.localeCompare(b)),
        )

        // Persist missing `order` fields so future fetches are stable + sortable.
        // (Firestore will happily sort missing fields, but the ordering is not user-friendly or stable.)
        if (hasAnyMissingOrder) {
          const batch = writeBatch(db)
          for (const task of nextTasks) {
            const ref = doc(collection(db, 'tasks'), task.id)
            batch.update(ref, { order: task.order })
          }
          await batch.commit()
        }
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
      writeCachedTasks(tasks)
    } catch {
      // ignore write errors
    }
  }, [tasks])

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      void syncTasks()
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function syncTasks() {
    if (syncInFlight.current) return
    if (!navigator.onLine) return

    const user = auth.currentUser
    if (!user) return

    const queue = readOfflineQueue()
    if (queue.length === 0) return

    syncInFlight.current = true
    setIsSyncing(true)

    // Offline sync logic:
    // - process queued operations sequentially to preserve user intent
    // - map offline-created temp IDs to server IDs, and rewrite remaining queued items + cached tasks
    try {
      const idMap = new Map<string, string>()

      for (const item of queue) {
        if (item.type === 'create') {
          const { tempId, task } = item.payload
          const created = await addDoc(collection(db, 'tasks'), task)
          idMap.set(tempId, created.id)

          setTasks((prev) =>
            prev.map((t) => (t.id === tempId ? { ...t, id: created.id } : t)),
          )
        } else if (item.type === 'update') {
          const docId = idMap.get(item.payload.id) ?? item.payload.id
          const ref = doc(collection(db, 'tasks'), docId)
          await updateDoc(ref, item.payload.updates)
        } else if (item.type === 'delete') {
          const docId = idMap.get(item.payload.id) ?? item.payload.id
          const ref = doc(collection(db, 'tasks'), docId)
          await deleteDoc(ref)
        } else if (item.type === 'reorder') {
          const batch = writeBatch(db)
          for (const entry of item.payload.orders) {
            const docId = idMap.get(entry.id) ?? entry.id
            const ref = doc(collection(db, 'tasks'), docId)
            batch.update(ref, { order: entry.order })
          }
          await batch.commit()
        }
      }

      // Rewrite queue and cached tasks with mapped IDs, then clear queue.
      if (idMap.size > 0) {
        setTasks((prev) => prev.map((t) => ({ ...t, id: idMap.get(t.id) ?? t.id })))
      }

      writeOfflineQueue([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed.'
      setError(message)
      // Keep queue so we can retry later.
    } finally {
      syncInFlight.current = false
      setIsSyncing(false)
    }
  }

  async function handleAssign(task: Task) {
    const email = window.prompt('Assign to collaborator (email):', task.assigned_email ?? '')
    if (!email) return

    try {
      const user = auth.currentUser
      if (!user) throw new Error('You must be signed in to assign tasks.')

      setAssigningTaskId(task.id)
      setAssignSaving(true)
      setError(null)

      const rawBase = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
      const apiBase = rawBase.replace(/\/$/, '')

      const res = await fetch(`${apiBase}/api/collab/tasks/${encodeURIComponent(task.id)}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId: email }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not assign task.')
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                assigned_email: email,
              }
            : t,
        ),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not assign task.'
      setError(message)
    } finally {
      setAssignSaving(false)
      setAssigningTaskId(null)
    }
  }

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
      const user = auth.currentUser
      if (!user) throw new Error('You must be signed in to manage tasks.')

      const nowIso = new Date().toISOString()
      const minExistingOrder = tasks.reduce((min, t) => (typeof t.order === 'number' ? Math.min(min, t.order) : min), 1)
      const nextOrder = tasks.length === 0 ? 1 : minExistingOrder - 1
      const taskDoc = {
        user_id: user.uid,
        title: trimmedTitle,
        description: trimmedDescription || null,
        due_date: normalizedDueDate,
        priority,
        category: trimmedCategory || null,
        created_at: nowIso,
        completed: false,
        order: nextOrder,
      }

      if (!navigator.onLine) {
        const tempId =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `local_${Date.now()}_${Math.random().toString(16).slice(2)}`

        setTasks((prev) => [
          {
            id: tempId,
            title: trimmedTitle,
            description: trimmedDescription || null,
            due_date: normalizedDueDate,
            priority,
            category: trimmedCategory || null,
            created_at: nowIso,
            completed: false,
            order: nextOrder,
          },
          ...prev,
        ])

        enqueueOfflineAction({ type: 'create', payload: { tempId, task: taskDoc } })
      } else {
        const docRef = await addDoc(collection(db, 'tasks'), taskDoc)
        setTasks((prev) => [
          {
            id: docRef.id,
            title: trimmedTitle,
            description: trimmedDescription || null,
            due_date: normalizedDueDate,
            priority,
            category: trimmedCategory || null,
            created_at: nowIso,
            completed: false,
            order: nextOrder,
          },
          ...prev,
        ])
      }

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
      const user = auth.currentUser
      if (!user) throw new Error('You must be signed in to manage tasks.')

      const updates = {
        title: trimmedTitle,
        description: trimmedDescription || null,
        due_date: normalizedDueDate,
        priority: editing.priority,
        category: trimmedCategory || null,
      }

      if (!navigator.onLine) {
        enqueueOfflineAction({ type: 'update', payload: { id: editing.id, updates } })
      } else {
        const ref = doc(collection(db, 'tasks'), editing.id)
        await updateDoc(ref, updates)
      }

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
    const nextCompleted = !task.completed
    try {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                completed: nextCompleted,
                completed_at: nextCompleted ? new Date().toISOString() : null,
              }
            : t,
        ),
      )
      const updates = {
        completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
      }

      if (!navigator.onLine) {
        enqueueOfflineAction({ type: 'update', payload: { id: task.id, updates } })
      } else {
        const ref = doc(collection(db, 'tasks'), task.id)
        await updateDoc(ref, updates)
      }
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
      if (!navigator.onLine) {
        enqueueOfflineAction({ type: 'delete', payload: { id: task.id } })
      } else {
        const ref = doc(collection(db, 'tasks'), task.id)
        await deleteDoc(ref)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete task.'
      setError(message)
    }
  }

  async function persistReorder(nextTasks: Task[]) {
    const orders = nextTasks.map((t, idx) => ({ id: t.id, order: idx + 1 }))
    setTasks(nextTasks.map((t, idx) => ({ ...t, order: idx + 1 })))

    if (!navigator.onLine) {
      enqueueOfflineAction({ type: 'reorder', payload: { orders } })
      return
    }

    try {
      const batch = writeBatch(db)
      for (const entry of orders) {
        const ref = doc(collection(db, 'tasks'), entry.id)
        batch.update(ref, { order: entry.order })
      }
      await batch.commit()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save new order.'
      setError(message)
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    if (!canReorder) return
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Reorder only within the currently visible list (no filters/search allowed).
    const visible = filteredTasks
    const oldIndex = visible.findIndex((t) => t.id === String(active.id))
    const newIndex = visible.findIndex((t) => t.id === String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    const nextVisible = arrayMove(visible, oldIndex, newIndex)

    // Apply the reordered visible list back onto the full task list.
    const visibleIds = new Set(nextVisible.map((t) => t.id))
    const rest = tasks.filter((t) => !visibleIds.has(t.id))
    void persistReorder([...nextVisible, ...rest])
  }

  function SortableTaskItem({
    task,
    children,
    disabled,
    className,
  }: {
    task: Task
    children: ReactNode
    disabled: boolean
    className?: string
  }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      disabled,
    })
    const style: CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.65 : 1,
    }
    return (
      <li ref={setNodeRef} style={style} className={className} {...attributes} {...(disabled ? {} : listeners)}>
        {children}
      </li>
    )
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
      {isOffline && <p className="banner">Offline Mode</p>}
      {isSyncing && <p className="banner">Syncing…</p>}
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
                <span className='priority-label'>Priority</span>
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

              {!canReorder && (
                <p className="tasks-subtitle" style={{ marginTop: 10 }}>
                  Clear filters/search to drag and reorder tasks.
                </p>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={filteredTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
                    <SortableTaskItem
                      key={task.id}
                      task={task}
                      disabled={!canReorder}
                      className={`task-item ${task.completed ? 'task-item--done' : ''}`}
                    >
                      <div className="task-card-header">
                        <button
                          type="button"
                          className={`task-check ${task.completed ? 'task-check--checked' : ''}`}
                          onClick={() => void toggleCompleted(task)}
                          aria-label={task.completed ? 'Mark as not completed' : 'Mark as completed'}
                        />
                        <div className="task-header-text">
                          <span className="task-title">{task.title}</span>
                        </div>
                        <span
                          className={`task-status task-status--${
                            task.completed ? 'completed' : isOverdue ? 'overdue' : 'pending'
                          } task-status--pill`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="task-card-body">
                        {task.description && (
                          <div className="task-card-row task-card-row--description">
                            <span className="task-card-label">Description</span>
                            <span className="task-card-value task-card-value--multiline">
                              {task.description}
                            </span>
                          </div>
                        )}
                        <div className="task-card-row">
                          <span className="task-card-label">Category</span>
                          <span className="task-card-value">{task.category ?? '—'}</span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Priority</span>
                          <span className="task-card-value">
                            {task.priority && (
                              <span className={`task-pill task-pill--${task.priority}`}>{task.priority}</span>
                            )}
                          </span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Created</span>
                          <span className="task-card-value">
                            {new Date(task.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                          </span>
                        </div>
                        <div className="task-card-row">
                          <span className="task-card-label">Due</span>
                          <span className="task-card-value">
                            {task.due_date
                              ? new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })
                              : '—'}
                          </span>
                        </div>
                      </div>

                      <div className="task-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
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
                          onClick={() => void handleAssign(task)}
                          disabled={assignSaving && assigningTaskId === task.id}
                          title={task.assigned_email ? `Assigned to ${task.assigned_email}` : 'Assign task'}
                        >
                          {task.assigned_email ? `Assigned: ${task.assigned_email}` : 'Assign'}
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
                    </SortableTaskItem>
                  )
                    })}
                  </ul>
                </SortableContext>
              </DndContext>
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

