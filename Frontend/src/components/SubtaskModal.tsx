import { useState } from "react";
import { HiXMark, HiPlus, HiTrash } from "react-icons/hi2";
import type { Subtask } from "../types/tasks";

type SubtaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subtasks: Subtask[]) => void;
  existingCollaborators: Array<{
    id: string;
    name: string;
    email: string;
    role?: string;
  }>;
  taskDueDate?: string | null;
};

type NewSubtask = {
  id: string;
  text: string;
  assignedTo?: string;
  role?: string;
  dueDate?: string;
};

export function SubtaskModal({
  isOpen,
  onClose,
  onSuccess,
  existingCollaborators,
  taskDueDate,
}: SubtaskModalProps) {
  const [subtasks, setSubtasks] = useState<NewSubtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [selectedRole, setSelectedRole] = useState("collaborator");
  const [selectedDueDate, setSelectedDueDate] = useState("");
  const [selectedCollaborator, setSelectedCollaborator] = useState("");
  const [loading, setLoading] = useState(false);

  const addSubtask = () => {
    if (!newSubtaskText.trim()) return;

    // Validate due date against task due date
    if (selectedDueDate && taskDueDate) {
      const subtaskDate = new Date(selectedDueDate);
      const taskDate = new Date(taskDueDate);

      if (subtaskDate > taskDate) {
        alert(
          `Subtask due date cannot be after the task due date (${new Date(taskDueDate).toLocaleDateString()})`,
        );
        return;
      }
    }

    const newSubtask: NewSubtask = {
      id: Date.now().toString(),
      text: newSubtaskText.trim(),
      role: selectedRole,
      assignedTo: selectedCollaborator || undefined,
      dueDate: selectedDueDate || undefined,
    };

    setSubtasks([...subtasks, newSubtask]);
    setNewSubtaskText("");
    setSelectedDueDate("");
    setSelectedCollaborator("");
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter((st) => st.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (subtasks.length === 0) {
      alert("Please add at least one subtask.");
      return;
    }

    setLoading(true);

    try {
      // Convert to Subtask format with role and due date
      const formattedSubtasks: Subtask[] = subtasks.map((st) => ({
        id: st.id,
        text: st.text,
        completed: false,
        assigned_to: st.assignedTo || null,
        role: st.role || "collaborator",
        due_date: st.dueDate || null,
        created_at: new Date().toISOString(),
      }));

      onSuccess(formattedSubtasks);
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error creating subtasks:", error);
      alert("Failed to create subtasks. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSubtasks([]);
    setNewSubtaskText("");
    setSelectedRole("collaborator");
    setSelectedDueDate("");
    setSelectedCollaborator("");
  };

  const getCollaboratorName = (id: string) => {
    const collaborator = existingCollaborators.find((c) => c.id === id);
    return collaborator?.name || collaborator?.email || "Unknown";
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="subtask-modal" onClick={(e) => e.stopPropagation()}>
        <div className="subtask-header">
          <h2>Add Subtasks</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <HiXMark />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="subtask-form">
          {/* Subtask Input */}
          <div className="form-section">
            <h3>Subtasks</h3>

            <div className="subtask-add">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="newSubtask">Add Subtask</label>
                  <input
                    id="newSubtask"
                    type="text"
                    value={newSubtaskText}
                    onChange={(e) => setNewSubtaskText(e.target.value)}
                    placeholder="Enter subtask description"
                    onKeyPress={(e) =>
                      e.key === "Enter" && (e.preventDefault(), addSubtask())
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <input
                    id="role"
                    type="text"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    placeholder="Enter role (e.g., Developer, Designer, Tester)"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dueDate">Due Date</label>
                  <input
                    id="dueDate"
                    type="date"
                    value={selectedDueDate}
                    onChange={(e) => setSelectedDueDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    max={
                      taskDueDate
                        ? new Date(taskDueDate).toISOString().split("T")[0]
                        : undefined
                    }
                  />
                  {taskDueDate && (
                    <small
                      style={{
                        color: "#94a3b8",
                        fontSize: "0.7rem",
                        marginTop: "2px",
                        display: "block",
                      }}
                    >
                      Task due: {new Date(taskDueDate).toLocaleDateString()}
                    </small>
                  )}
                </div>

                {existingCollaborators.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="assignTo">Assign To</label>
                    <select
                      id="assignTo"
                      value={selectedCollaborator}
                      onChange={(e) => setSelectedCollaborator(e.target.value)}
                    >
                      <option value="">Select collaborator...</option>
                      {existingCollaborators.map((collaborator) => (
                        <option key={collaborator.id} value={collaborator.id}>
                          {collaborator.name}{" "}
                          {collaborator.email && `(${collaborator.email})`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="add-subtask-btn"
                onClick={addSubtask}
                disabled={!newSubtaskText.trim()}
              >
                <HiPlus /> Add Subtask
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="subtasks-list">
                <h4>Subtasks ({subtasks.length}):</h4>
                {subtasks.map((subtask, index) => (
                  <div key={subtask.id} className="subtask-item">
                    <span className="subtask-number">{index + 1}.</span>
                    <span className="subtask-text">{subtask.text}</span>
                    <div className="subtask-details">
                      {subtask.assignedTo && (
                        <span className="subtask-assigned-person">
                          Assigned to: {getCollaboratorName(subtask.assignedTo)}
                        </span>
                      )}
                      {subtask.role && (
                        <span className="subtask-role">
                          Role: {subtask.role}
                        </span>
                      )}
                      {subtask.dueDate && (
                        <span className="subtask-due-date">
                          Due: {new Date(subtask.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeSubtask(subtask.id)}
                    >
                      <HiTrash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || subtasks.length === 0}
            >
              {loading
                ? "Adding..."
                : `Add ${subtasks.length} Subtask${subtasks.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
