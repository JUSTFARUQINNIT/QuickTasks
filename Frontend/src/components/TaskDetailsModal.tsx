import { useEffect, useState } from 'react'
import type { Task } from '../types/tasks'
import { collection, doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebaseClient'

type TaskDetailsModalProps = {
  task: Task
  isOwner: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onToggleComplete: (task: Task) => void
  onDelete: (task: Task) => void
  onInviteCollaborator: () => void
}

export function TaskDetailsModal({
  task,
  isOwner,
  onClose,
  onEdit,
  onToggleComplete,
  onDelete,
  onInviteCollaborator,
}: TaskDetailsModalProps) {
  const [collaboratorLabels, setCollaboratorLabels] = useState<string[] | null>(null)
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false)
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null)

  const currentUserId = auth.currentUser?.uid ?? null
  const isSelfCollaborator =
    !!currentUserId && Array.isArray(task.collaborators) && task.collaborators.includes(currentUserId)

  const roleLabel = task.isInvited || isSelfCollaborator ? 'Collaborator' : isOwner ? 'Owner' : null

  // Load collaborators (all users shared on this task)
  useEffect(() => {
    let isMounted = true

    async function loadCollaborators() {
      const ids = Array.from(new Set(task.collaborators ?? [])).filter(
        (id) => typeof id === 'string' && id.length > 0
      )
      if (ids.length === 0) {
        if (isMounted) {
          setCollaboratorLabels([])
          setCollaboratorsLoading(false)
        }
        return
      }

      setCollaboratorsLoading(true)
      try {
        const labels: string[] = []
        await Promise.all(
          ids.map(async (uid) => {
            try {
              const ref = doc(collection(db, 'profiles'), uid)
              const snap = await getDoc(ref)
              if (!snap.exists()) {
                labels.push(uid)
                return
              }
              const data = snap.data() as { email?: string | null; username?: string | null }
              labels.push(data.username ?? data.email ?? uid)
            } catch {
              labels.push(uid)
            }
          })
        )
        if (!isMounted) return
        setCollaboratorLabels(labels)
      } finally {
        if (isMounted) setCollaboratorsLoading(false)
      }
    }

    void loadCollaborators()

    return () => {
      isMounted = false
    }
  }, [])

  // Load owner username/email
  useEffect(() => {
    let isMounted = true

    async function loadOwner() {
      if (!task.ownerId) return
      try {
        const ref = doc(collection(db, 'profiles'), task.ownerId)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          if (isMounted) setOwnerLabel(task.ownerId)
          return
        }
        const data = snap.data() as { email?: string | null; username?: string | null }
        if (isMounted) setOwnerLabel(data.username ?? data.email ?? task.ownerId)
      } catch {
        if (isMounted) setOwnerLabel(task.ownerId)
      }
    }

    void loadOwner()

    return () => {
      isMounted = false
    }
  }, [task.ownerId])

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <h2 className="modal-title">Task details</h2>
        <p className="modal-subtitle">Review and manage this task.</p>

        {/* Notice for collaborators */}
        {!isOwner && (task.isInvited || isSelfCollaborator) && (
          <div className="task-card-row">
            <span className="task-card-label" />
            <span
              className="task-card-value task-card-value--multiline"
              style={{ color: '#cf1818', textAlign: 'center', marginBottom: 12 }}
            >
              You can mark this task as complete, but editing is restricted. Other collaborators are visible below.
            </span>
          </div>
        )}

        <div className="tasks-details">
          <div className="task-card-row">
            <span className="task-card-label">Title</span>
            <span className="task-card-value">{task.title}</span>
          </div>

          {roleLabel && (
            <div className="task-card-row">
              <span className="task-card-label">Role</span>
              <span className="task-card-value">
                <span
                  className={`task-pill ${
                    roleLabel === 'Owner' ? 'task-pill--owner' : 'task-pill--collaborator'
                  }`}
                >
                  {roleLabel === 'Owner' ? '👑 Owner' : '🤝 Collaborator'}
                </span>
              </span>
            </div>
          )}

          {ownerLabel && (
            <div className="task-card-row">
              <span className="task-card-label">Owner</span>
              <span className="task-card-value">{ownerLabel}</span>
            </div>
          )}

          {task.description && (
            <div className="task-card-row">
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
              <span className={`task-pill task-pill--${task.priority}`}>{task.priority}</span>
            </span>
          </div>

          <div className="task-card-row">
            <span className="task-card-label">Due date</span>
            <span className="task-card-value">
              {task.due_date
                ? new Date(task.due_date).toLocaleDateString(undefined, { dateStyle: 'medium' })
                : '—'}
            </span>
          </div>

          <div className="task-card-row">
            <span className="task-card-label">Created</span>
            <span className="task-card-value">
              {new Date(task.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            </span>
          </div>

          <div className="task-card-row">
            <span className="task-card-label">Status</span>
            <span className="task-card-value">
              <span
                className={`task-status task-status--${
                  task.completed ? 'completed' : 'pending'
                } task-status--pill`}
              >
                {task.completed ? 'Completed' : 'Pending'}
              </span>
            </span>
          </div>

          {task.assigned_email && (
            <div className="task-card-row">
              <span className="task-card-label">Assigned email</span>
              <span className="task-card-value">{task.assigned_email}</span>
            </div>
          )}

          <div className="task-card-row">
            <span className="task-card-label">Collaborators</span>
            <span className="task-card-value task-card-value--multiline">
              {collaboratorsLoading
                ? 'Loading team...'
                : collaboratorLabels && collaboratorLabels.length > 0
                  ? collaboratorLabels.join(', ')
                  : 'No collaborators yet'}
            </span>
          </div>
        </div>

        <div className="collaborators-form-actions" style={{ marginTop: 24, justifyContent: 'space-between' }}>
            {isOwner ? (
              <>
                <button type="button" className="primary-btn" onClick={() => onEdit(task)}>
                  Edit task
                </button>
                <div
                  style={{
                    marginTop: 18,
                    marginBottom: 10,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                    width: '100%',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    className="secondary-btn task-action-btn"
                    onClick={onInviteCollaborator}
                  >
                    Invite collaborator
                  </button>
                  <button
                    type="button"
                    className="secondary-btn task-action-btn"
                    onClick={() => onToggleComplete(task)}
                  >
                    {task.completed ? 'Undo complete' : 'Mark complete'}
                  </button>
                  <button
                    type="button"
                    className="task-action-btn task-action-btn--danger"
                    onClick={() => onDelete(task)}
                  >
                    Delete task
                  </button>
                </div>
              </>
            ) : task.isInvited ? (
              <button
                type="button"
                className="primary-btn collaborator"
                onClick={() => onToggleComplete(task)}
              >
                {task.completed ? 'Mark as not done' : 'Mark as done'}
              </button>
            ) : null}
          {/* </div> */}

          <button type="button" className="ghost-btn tasks-cancel-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    // </div>
  )
}