import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "../lib/firebaseClient";
import { NotificationBanner } from "./NotificationBanner";
import { useNotification } from "../hooks/useNotification";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

type Category = {
  id: string;
  name: string;
  created_at: string;
};

type CategoryEditingState = Category | null;

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<{ id: string; category: string | null }[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CategoryEditingState>(null);
  const { notification, showSuccessNotification, showErrorNotification } =
    useNotification();

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        try {
          const cached = localStorage.getItem("qt:categories");
          if (cached) {
            const parsed = JSON.parse(cached) as Category[];
            if (Array.isArray(parsed)) {
              setCategories(parsed);
              setLoading(false);
            }
          }
        } catch {
          // ignore cache errors
        }

        const user = auth.currentUser;
        if (!user) {
          if (!isMounted) return;
          setCategories([]);
          setTasks([]);
          setLoading(false);
          return;
        }

        const categoriesQuery = query(
          collection(db, "categories"),
          where("user_id", "==", user.uid),
          orderBy("created_at", "asc"),
        );
        const tasksQuery = query(
          collection(db, "tasks"),
          where("user_id", "==", user.uid),
        );

        const [categoriesSnapshot, tasksSnapshot] = await Promise.all([
          getDocs(categoriesQuery),
          getDocs(tasksQuery),
        ]);

        if (!isMounted) return;

        const categoryData = categoriesSnapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<Category, "id">),
        }));
        const taskData = tasksSnapshot.docs.map((d) => ({
          id: d.id,
          category: (d.data() as { category?: string | null }).category ?? null,
        }));

        setCategories(categoryData as Category[]);
        setTasks(taskData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load categories.";
        if (!isMounted) return;
        setError(message);
        showErrorNotification(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("qt:categories", JSON.stringify(categories));
    } catch {
      // ignore write errors
    }
  }, [categories]);

  const countsByCategory = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      const key = (task.category ?? "").trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [tasks]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const trimmedName = name.trim();

      const duplicateExists = categories.some(
        (c) =>
          c.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
          (!editing || c.id !== editing.id),
      );

      if (duplicateExists) {
        const msg = "A category with this name already exists.";
        setError(msg);
        showErrorNotification(msg);
        return;
      }

      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to manage categories.");

      if (editing) {
        const categoryRef = doc(db, "categories", editing.id);
        await updateDoc(categoryRef, { name: trimmedName });

        const tasksQuery = query(
          collection(db, "tasks"),
          where("user_id", "==", user.uid),
          where("category", "==", editing.name),
        );
        const tasksSnapshot = await getDocs(tasksQuery);
        const batch = writeBatch(db);
        tasksSnapshot.forEach((taskDoc) => {
          batch.update(taskDoc.ref, { category: trimmedName });
        });
        await batch.commit();

        setCategories((prev) =>
          prev.map((c) =>
            c.id === editing.id ? { ...c, name: trimmedName } : c,
          ),
        );
        setTasks((prev) =>
          prev.map((t) =>
            t.category === editing.name ? { ...t, category: trimmedName } : t,
          ),
        );
      } else {
        const nowIso = new Date().toISOString();
        const newRef = await addDoc(collection(db, "categories"), {
          user_id: user.uid,
          name: trimmedName,
          created_at: nowIso,
        });

        setCategories((prev) => [
          ...prev,
          { id: newRef.id, name: trimmedName, created_at: nowIso },
        ]);
      }

      const successMsg = editing
        ? "Category updated successfully."
        : "Category created successfully.";
      setName("");
      setEditing(null);
      showSuccessNotification(successMsg);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save category.";
      setError(message);
      showErrorNotification(message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setEditing(category);
    setName(category.name);
  }

  async function handleDelete(category: Category) {
    if (
      !window.confirm(
        `Delete category "${category.name}"? Tasks will keep their data but lose this category.`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("You must be signed in to manage categories.");

      const categoryRef = doc(db, "categories", category.id);
      const tasksQuery = query(
        collection(db, "tasks"),
        where("user_id", "==", user.uid),
        where("category", "==", category.name),
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const batch = writeBatch(db);
      batch.delete(categoryRef);
      tasksSnapshot.forEach((taskDoc) => {
        batch.update(taskDoc.ref, { category: null });
      });
      await batch.commit();

      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      setTasks((prev) =>
        prev.map((t) =>
          t.category === category.name ? { ...t, category: null } : t,
        ),
      );

      if (editing?.id === category.id) {
        setEditing(null);
        setName("");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not delete category.";
      setError(message);
      showErrorNotification(message);
    } finally {
      setSaving(false);
    }
  }

  const hasCategories = categories.length > 0;

  return (
    <div className="tasks-shell">
      <section className="tasks-panel tasks-form-panel">
        <h2 className="tasks-heading">
          {editing ? "Edit category" : "Add category"}
        </h2>
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

          <div className="categories-form-actions">
            <button type="submit" className="primary-btn" disabled={saving}>
              {saving
                ? editing
                  ? "Saving…"
                  : "Adding…"
                : editing
                  ? "Save category"
                  : "Add category"}
            </button>
            {editing && (
              <button
                type="button"
                className="ghost-btn tasks-cancel-btn"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
                disabled={saving}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>

        <NotificationBanner notification={notification} />
      </section>

      <section
        className="tasks-panel tasks-list-panel"
        style={{ marginTop: "10px" }}
      >
        <h2 className="tasks-heading">Categories</h2>
        {loading ? (
          <div className="tasks-empty">
            <div className="spinner" />
          </div>
        ) : !hasCategories ? (
          <div className="tasks-empty">
            <p>
              No categories yet. Add your first one to start organising tasks.
            </p>
          </div>
        ) : (
         <div className="tasks-table-wrapper">
  {/* Desktop Table */}
  <table className="tasks-table categories-table-desktop">
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
          <td className="category-table-actions">
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

  {/* Mobile Cards */}
  <div className="categories-cards-mobile">
    {categories.map((category) => (
      <div key={category.id} className="category-card">
        <div className="category-card-header">
          <h3>{category.name}</h3>
          <span className="category-count">
            {countsByCategory.get(category.name) ?? 0} tasks
          </span>
        </div>

        <div className="category-card-actions">
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
        </div>
      </div>
    ))}
  </div>
</div>
        )}
      </section>
    </div>
  );
}
