import { useState } from "react";
import { HiXMark, HiPlus, HiUser, HiTrash } from "react-icons/hi2";
import type { Subtask } from "../types/tasks";

type SubtaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (subtasks: Subtask[]) => void;
  existingCollaborators: Array<{ id: string; name: string; email: string }>;
};

type NewSubtask = {
  id: string;
  text: string;
  assignedTo?: string;
};

export function SubtaskModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  existingCollaborators 
}: SubtaskModalProps) {
  const [subtasks, setSubtasks] = useState<NewSubtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [loading, setLoading] = useState(false);

  const addSubtask = () => {
    if (!newSubtaskText.trim()) return;

    const newSubtask: NewSubtask = {
      id: Date.now().toString(),
      text: newSubtaskText.trim()
    };

    setSubtasks([...subtasks, newSubtask]);
    setNewSubtaskText("");
  };

  const removeSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const updateSubtaskAssignment = (subtaskId: string, assignedTo: string) => {
    setSubtasks(subtasks.map(st => 
      st.id === subtaskId ? { ...st, assignedTo } : st
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (subtasks.length === 0) {
      alert("Please add at least one subtask.");
      return;
    }

    setLoading(true);

    try {
      // Convert to Subtask format
      const formattedSubtasks: Subtask[] = subtasks.map(st => ({
        id: st.id,
        text: st.text,
        completed: false,
        assigned_to: st.assignedTo || null,
        created_at: new Date().toISOString()
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
  };

  const getCollaboratorName = (id: string) => {
    const collaborator = existingCollaborators.find(c => c.id === id);
    return collaborator?.name || collaborator?.email || 'Unknown';
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
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addSubtask())}
                  />
                </div>
                
                {existingCollaborators.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="assignTo">Assign To</label>
                    <select
                      id="assignTo"
                      value={subtasks[subtasks.length - 1]?.assignedTo || ""}
                      onChange={(e) => {
                        if (subtasks.length > 0) {
                          updateSubtaskAssignment(subtasks[subtasks.length - 1].id, e.target.value);
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {existingCollaborators.map((collaborator) => (
                        <option key={collaborator.id} value={collaborator.id}>
                          {collaborator.name}
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
                    {subtask.assignedTo && (
                      <span className="subtask-assigned">
                        {getCollaboratorName(subtask.assignedTo)}
                      </span>
                    )}
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
            <button type="submit" className="btn-primary" disabled={loading || subtasks.length === 0}>
              {loading ? "Adding..." : `Add ${subtasks.length} Subtask${subtasks.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
