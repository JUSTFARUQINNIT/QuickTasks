import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Category = {
  id: string
  name: string
  created_at: string
}

type CategoryEditingState = Category | null

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [tasks, setTasks] = useState<{ id: string; category: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [editing, setEditing] = useState<CategoryEditingState>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        try {
          const cached = localStorage.getItem('qt:categories')
          if (cached) {
            const parsed = JSON.parse(cached) as Category[]
            if (Array.isArray(parsed)) {
              setCategories(parsed)
              setLoading(false)
            }
          }
        } catch {
          // ignore cache errors
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          if (!isMounted) return
          setCategories([])
          setTasks([])
          setLoading(false)
          return
        }

        const [{ data: categoryData, error: categoryError }, { data: taskData, error: taskError }] = await Promise.all([
          supabase.from('categories').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
          supabase
            .from('tasks')
            .select('id, category')
            .eq('user_id', user.id),
        ])

        if (categoryError) throw categoryError
        if (taskError) throw taskError

        if (!isMounted) return
        setCategories((categoryData ?? []) as Category[])
        setTasks((taskData ?? []) as { id: string; category: string | null }[])
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not load categories.'
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
      localStorage.setItem('qt:categories', JSON.stringify(categories))
    } catch {
      // ignore write errors
    }
  }, [categories])

  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    tasks.forEach((task) => {
      const key = (task.category ?? '').trim()
      if (!key) return
      counts.set(key, (counts.get(key) ?? 0) + 1)
    })
    return counts
  }, [tasks])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    setError(null)

    try {
      const trimmedName = name.trim()

      const duplicateExists = categories.some(
        (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase() && (!editing || c.id !== editing.id),
      )

      if (duplicateExists) {
        setError('A category with this name already exists.')
        return
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('You must be signed in to manage categories.')

      if (editing) {
        const { error: updateError } = await supabase
          .from('categories')
          .update({ name: trimmedName })
          .eq('id', editing.id)
          .eq('user_id', user.id)

        if (updateError) throw updateError

        const { error: taskUpdateError } = await supabase
          .from('tasks')
          .update({ category: trimmedName })
          .eq('user_id', user.id)
          .eq('category', editing.name)

        if (taskUpdateError) throw taskUpdateError

        setCategories((prev) => prev.map((c) => (c.id === editing.id ? { ...c, name: trimmedName } : c)))
        setTasks((prev) =>
          prev.map((t) => (t.category === editing.name ? { ...t, category: trimmedName } : t)),
        )
      } else {
        const { data, error: insertError } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: trimmedName,
          })
          .select()
          .single()

        if (insertError) throw insertError

        setCategories((prev) => [...prev, data as Category])
      }

      setName('')
      setEditing(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save category.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(category: Category) {
    setEditing(category)
    setName(category.name)
  }

  async function handleDelete(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"? Tasks will keep their data but lose this category.`)) {
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
      if (!user) throw new Error('You must be signed in to manage categories.')

      const [{ error: deleteError }, { error: clearTasksError }] = await Promise.all([
        supabase.from('categories').delete().eq('id', category.id).eq('user_id', user.id),
        supabase
          .from('tasks')
          .update({ category: null })
          .eq('user_id', user.id)
          .eq('category', category.name),
      ])

      if (deleteError) throw deleteError
      if (clearTasksError) throw clearTasksError

      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      setTasks((prev) =>
        prev.map((t) => (t.category === category.name ? { ...t, category: null } : t)),
      )

      if (editing?.id === category.id) {
        setEditing(null)
        setName('')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete category.'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const hasCategories = categories.length > 0

  return (
    <div className="tasks-shell">
      <section className="tasks-panel tasks-form-panel">
        <h2 className="tasks-heading">{editing ? 'Edit category' : 'Add category'}</h2>
        <p className="tasks-subtitle">
          Use categories to group tasks by project, theme, or area of focus.
        </p>

        <form className="tasks-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Personal, Work, Errands"
              required
            />
          </label>

          <div className="tasks-form-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving ? (editing ? 'Saving…' : 'Adding…') : editing ? 'Save category' : 'Add category'}
            </button>
            {editing && (
              <button
                type="button"
                className="ghost-btn tasks-cancel-btn"
                onClick={() => {
                  setEditing(null)
                  setName('')
                }}
                disabled={saving}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        {error && <p className="banner banner-error">{error}</p>}
      </section>

      <section className="tasks-panel tasks-list-panel" style={{ marginTop: '10px' }}>
        <h2 className="tasks-heading">Categories</h2>
        {loading ? (
          <div className="tasks-empty">
            <div className="spinner" />
          </div>
        ) : !hasCategories ? (
          <div className="tasks-empty">
            <p>No categories yet. Add your first one to start organising tasks.</p>
          </div>
        ) : (
          <div className="tasks-table-wrapper">
            <table className="tasks-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Tasks</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{countsByCategory.get(category.name) ?? 0}</td>
                    <td className="tasks-table-actions">
                      <button
                        type="button"
                        className="task-action-btn"
                        onClick={() => startEdit(category)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="task-action-btn task-action-btn--danger"
                        onClick={() => void handleDelete(category)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

