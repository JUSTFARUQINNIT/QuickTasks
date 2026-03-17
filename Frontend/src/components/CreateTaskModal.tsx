import { useState } from "react";
import { HiXMark, HiPlus, HiUser, HiTrash } from "react-icons/hi2";
import { auth, db } from "../lib/firebaseClient";
import { 
  collection, 
  doc, 
  addDoc, 
  serverTimestamp,
  query, 
  where, 
  getDocs 
} from "firebase/firestore";
// import type { Subtasks } from "../types/tasks";

type CreateTaskModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type CollaboratorRole = {
  userId: string;
  email: string;
  name: string;
  role: string;
};

type NewSubtask = {
  id: string;
  text: string;
  assignedTo?: string;
};

export function CreateTaskModal({ isOpen, onClose, onSuccess }: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [collaboratorEmail, setCollaboratorEmail] = useState("");
  const [collaboratorRole, setCollaboratorRole] = useState("collaborator");
  const [collaborators, setCollaborators] = useState<CollaboratorRole[]>([]);
  const [subtasks, setSubtasks] = useState<NewSubtask[]>([]);
  const [newSubtaskText, setNewSubtaskText] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [emailError, setEmailError] = useState("");

  const currentUser = auth.currentUser;

  const searchUser = async (email: string) => {
    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email");
      return;
    }

    setSearching(true);
    setEmailError("");

    try {
      const profilesRef = collection(db, "profiles");
      const q = query(profilesRef, where("email", "==", email.toLowerCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setEmailError("User not found");
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      if (userData.uid === currentUser?.uid) {
        setEmailError("You cannot add yourself as a collaborator");
        return;
      }

      // Check if already added
      if (collaborators.some(c => c.userId === userData.uid)) {
        setEmailError("User already added");
        return;
      }

      const newCollaborator: CollaboratorRole = {
        userId: userData.uid,
        email: userData.email,
        name: userData.username || userData.email,
        role: collaboratorRole
      };

      setCollaborators([...collaborators, newCollaborator]);
      setCollaboratorEmail("");
      setCollaboratorRole("collaborator");
    } catch (error) {
      console.error("Error searching for user:", error);
      setEmailError("Error searching for user");
    } finally {
      setSearching(false);
    }
  };

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

  const removeCollaborator = (userId: string) => {
    setCollaborators(collaborators.filter(c => c.userId !== userId));
    // Remove assignments for removed collaborator
    setSubtasks(subtasks.map(st => 
      st.assignedTo === userId ? { ...st, assignedTo: undefined } : st
    ));
  };

  const calculateProgress = () => {
    if (subtasks.length === 0) return 0;
    return 0; // Will be calculated when subtasks are completed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !currentUser) return;

    setLoading(true);

    try {
      const taskData = {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        due_date: dueDate || null,
        category: category.trim() || null,
        user_id: currentUser.uid,
        shared: collaborators.length > 0,
        collaborators: collaborators.map(c => c.userId),
        completed: false,
        created_at: serverTimestamp(),
        order: Date.now(),
        subtasks: subtasks.map(st => ({
          id: st.id,
          text: st.text,
          completed: false,
          assigned_to: st.assignedTo || null,
          created_at: new Date().toISOString()
        })),
        attachments: []
      };

      const docRef = await addDoc(collection(db, "tasks"), taskData);
      
      // Create projections for each collaborator
      for (const collaborator of collaborators) {
        const userTasksRef = collection(db, "userTasks", collaborator.userId, "tasks");
        await addDoc(userTasksRef, {
          ...taskData,
          id: docRef.id,
          isInvited: true,
          ref: docRef.id,
          updatedAt: new Date().toISOString()
        });
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Failed to create task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
    setCategory("");
    setCollaboratorEmail("");
    setCollaboratorRole("collaborator");
    setCollaborators([]);
    setSubtasks([]);
    setNewSubtaskText("");
    setEmailError("");
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="create-task-modal" onClick={(e) => e.stopPropagation()}>
        <div className="create-task-header">
          <h2>Create New Task</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <HiXMark />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-task-form">
          {/* Basic Task Information */}
          <div className="form-section">
            <h3>Task Details</h3>
            
            <div className="form-group">
              <label htmlFor="title">Task Title *</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Enter task title"
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter task description"
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="dueDate">Due Date</label>
                <input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Enter category"
                />
              </div>
            </div>
          </div>

          {/* Collaborators Section */}
          <div className="form-section">
            <h3>Collaborators</h3>
            
            <div className="collaborator-add">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="collaboratorEmail">Add Collaborator</label>
                  <input
                    id="collaboratorEmail"
                    type="email"
                    value={collaboratorEmail}
                    onChange={(e) => {
                      setCollaboratorEmail(e.target.value);
                      setEmailError("");
                    }}
                    placeholder="Enter email address"
                  />
                  {emailError && <span className="error-text">{emailError}</span>}
                </div>
                
                <div className="form-group">
                  <label htmlFor="role">Role</label>
                  <select
                    id="role"
                    value={collaboratorRole}
                    onChange={(e) => setCollaboratorRole(e.target.value)}
                  >
                    <option value="collaborator">Collaborator</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="assignee">Assignee</option>
                  </select>
                </div>
              </div>
              
              <button
                type="button"
                className="add-collaborator-btn"
                onClick={() => searchUser(collaboratorEmail)}
                disabled={searching || !collaboratorEmail}
              >
                {searching ? "Searching..." : "Add Collaborator"}
              </button>
            </div>

            {collaborators.length > 0 && (
              <div className="collaborators-list">
                <h4>Added Collaborators:</h4>
                {collaborators.map((collaborator) => (
                  <div key={collaborator.userId} className="collaborator-item">
                    <div className="collaborator-info">
                      <HiUser />
                      <div>
                        <div className="collaborator-name">{collaborator.name}</div>
                        <div className="collaborator-email">{collaborator.email}</div>
                      </div>
                      <span className="collaborator-role">{collaborator.role}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeCollaborator(collaborator.userId)}
                    >
                      <HiTrash />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtasks Section */}
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
                
                {collaborators.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="assignTo">Assign To</label>
                    <select
                      id="assignTo"
                      value={subtasks.find(st => st.id === subtasks[subtasks.length - 1]?.id)?.assignedTo || ""}
                      onChange={(e) => {
                        if (subtasks.length > 0) {
                          updateSubtaskAssignment(subtasks[subtasks.length - 1].id, e.target.value);
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {collaborators.map((collaborator) => (
                        <option key={collaborator.userId} value={collaborator.userId}>
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
                        {collaborators.find(c => c.userId === subtask.assignedTo)?.name || "Assigned"}
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

          {/* Progress Preview */}
          {subtasks.length > 0 && (
            <div className="progress-preview">
              <h4>Task Progress</h4>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${calculateProgress()}%` }}
                />
              </div>
              <span className="progress-text">0 / {subtasks.length} completed (0%)</span>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !title.trim()}>
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
