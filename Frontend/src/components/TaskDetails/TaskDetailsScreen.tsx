import { auth, db } from "../../lib/firebaseClient";
import type { Attachment, Task } from "../../types/tasks";
import { calculateTaskCompletion } from "../../utils/taskCompletion";
import { deleteTaskAttachment, uploadTaskAttachment } from "../../api/tasks";
import { NotificationBanner } from "../NotificationBanner";
import { useNotification } from "../../hooks/useNotification";
import { TaskHeader } from "./TaskHeader";
import { ProfileModal } from "./ProfileModal";
import { SubtaskModal } from "../SubtaskModal";
import { useState, useRef, useEffect } from "react";
import {
  doc,
  updateDoc,
  arrayUnion,
  getDoc,
  addDoc,
  collection,
  onSnapshot,
} from "firebase/firestore";
import {
  HiPlus,
  HiCheck,
  HiCalendar,
  HiClock,
  HiUserCircle,
  HiCheckCircle,
  HiUserPlus,
  HiShare,
  HiChatBubbleLeft,
  HiDocument,
  HiPhoto,
  HiVideoCamera,
  HiArchiveBox,
  HiTableCells,
  HiDocumentText,
  HiComputerDesktop,
  HiArrowDownTray,
  HiTrash,
  HiXMark,
} from "react-icons/hi2";

type TaskDetailsScreenProps = {
  task: Task;
  isOwner: boolean;
  ownerLabel: string | null;
  roleLabel: string | null;
  collaboratorLabels: string[] | null;
  onBack: () => void;
  onEdit: () => void;
  onDelete?: () => void;
  onInviteCollaborator: () => void;
  onOpenComments: () => void;
};

export function TaskDetailsScreen({
  task,
  isOwner,
  ownerLabel,
  roleLabel,
  collaboratorLabels,
  onBack,
  onEdit,
  onDelete,
  onInviteCollaborator,
  onOpenComments,
}: TaskDetailsScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string | null;
    avatarData?: string | null;
    role: string;
  } | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState<{ [key: string]: any }>({});
  const [subtaskModalOpen, setSubtaskModalOpen] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task>(task);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [subtaskToDeleteId, setSubtaskToDeleteId] = useState<string | null>(
    null,
  );
  const { notification, showSuccessNotification, showErrorNotification } =
    useNotification();

  const handleDeleteTask = async () => {
    if (!isOwner) {
      showErrorNotification("Only the task owner can delete this task.");
      return;
    }

    setShowDeleteModal(true);
  };

  // Notifications are driven via useNotification hook and NotificationBanner.

  const confirmDeleteTask = async () => {
    try {
      await onDelete?.();
      setShowDeleteModal(false);
      showSuccessNotification("Task deleted successfully!");
      onBack(); // Go back to task list after deletion
    } catch (error) {
      console.error("Error deleting task:", error);
      showErrorNotification("Failed to delete task. Please try again.");
    }
  };

  const cancelDeleteTask = () => {
    setShowDeleteModal(false);
  };

  const requestDeleteSubtask = (subtaskId: string) => {
    if (!isOwner) {
      showErrorNotification("Only the task owner can delete subtasks.");
      return;
    }
    setSubtaskToDeleteId(subtaskId);
  };

  const confirmDeleteSubtask = async () => {
    if (!subtaskToDeleteId) return;
    try {
      const updatedSubtasks = subtasks.filter(
        (st) => st.id !== subtaskToDeleteId,
      );
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        subtasks: updatedSubtasks,
      });
      setSubtaskToDeleteId(null);
      showSuccessNotification("Subtask deleted successfully!");
    } catch (error) {
      console.error("Error deleting subtask:", error);
      showErrorNotification("Failed to delete subtask. Please try again.");
    }
  };

  const cancelDeleteSubtask = () => {
    setSubtaskToDeleteId(null);
  };

  // Real-time task listener
  useEffect(() => {
    const taskRef = doc(db, "tasks", task.id);
    const unsubscribe = onSnapshot(
      taskRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const updatedTask = {
            ...(docSnapshot.data() as Task),
            id: docSnapshot.id,
          };
          setCurrentTask(updatedTask);
        }
      },
      (error) => {
        console.error("Error listening to task updates:", error);
      },
    );

    return () => unsubscribe();
  }, [task.id]);

  // Use real subtasks from database or empty array
  const subtasks = currentTask.subtasks || [];

  // Use real attachments from database or empty array
  const attachments = currentTask.attachments || [];

  function canDeleteFile(
    user: { id: string } | null,
    taskData: { ownerId?: string | null },
    file: { uploadedBy?: string | null },
  ) {
    if (!user?.id) return false;
    return user.id === taskData.ownerId || user.id === file.uploadedBy;
  }

  const getAttachmentDisplayName = (attachment: Attachment) =>
    attachment.originalName || attachment.name || "Unnamed file";

  const getAttachmentUploadedBy = (attachment: Attachment) =>
    attachment.uploadedBy || attachment.uploaded_by || null;

  // Load profile data for collaborators and owner
  useEffect(() => {
    const loadProfileData = async () => {
      const profiles: { [key: string]: any } = {};
      const userIds = new Set<string>();

      // Add owner ID
      if (currentTask.ownerId) {
        userIds.add(currentTask.ownerId);
      }

      // Add collaborator IDs
      if (currentTask.collaborators) {
        currentTask.collaborators.forEach((id) => userIds.add(id));
      }

      // Load profiles for all users
      for (const userId of userIds) {
        try {
          const profileRef = doc(db, "profiles", userId);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            profiles[userId] = profileSnap.data();
          } else {
            // Create a default profile if it doesn't exist
            profiles[userId] = {
              username: `User ${userId.slice(0, 8)}`,
              email: "",
              role: "collaborator",
            };
          }
        } catch (error) {
          console.error(`Error loading profile for ${userId}:`, error);
          // Create a default profile on error
          profiles[userId] = {
            username: `User ${userId.slice(0, 8)}`,
            email: "",
            role: "collaborator",
          };
        }
      }

      setProfileData(profiles);
    };

    loadProfileData();
  }, [currentTask.ownerId, currentTask.collaborators]);

  const toggleSubtask = async (subtaskId: string) => {
    const subtask = subtasks.find((st) => st.id === subtaskId);
    if (!subtask) return;

    // Check if user can complete this subtask
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    // Owner can complete any subtask
    // Collaborators can ONLY complete subtasks explicitly assigned to them
    if (!isOwner && subtask.assigned_to !== currentUser.uid) {
      showErrorNotification("You can only complete subtasks assigned to you.");
      return;
    }

    try {
      const isCompleting = !subtask.completed;

      // Use backend API for subtask updates to handle permissions properly
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const response = await fetch(
        `https://quicktasks-28yz.onrender.com/api/tasks/${task.id}`,
        // `http://localhost:8787/api/tasks/${task.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: "subtask",
            data: {
              id: subtaskId,
              completed: isCompleting,
            },
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update subtask");
      }

      // Create notification for completed subtask
      if (isCompleting) {
        await createSubtaskCompletionNotification(subtask, currentUser);
      }

      // Update task completion based on subtask progress
      await updateTaskCompletionBasedOnSubtasks();
    } catch (error) {
      console.error("Error updating subtask:", error);
      showErrorNotification("Failed to update subtask. Please try again.");
    }
  };

  const addNewSubtask = () => {
    if (!isOwner) return;
    setSubtaskModalOpen(true);
  };

  const handleSubtasksCreated = async (newSubtasks: any[]) => {
    try {
      const taskRef = doc(db, "tasks", task.id);
      await updateDoc(taskRef, {
        subtasks: arrayUnion(...newSubtasks),
      });

      // Create notifications for assigned collaborators
      await createSubtaskNotifications(newSubtasks);

      // Update task completion based on subtask progress (new subtasks might change completion status)
      await updateTaskCompletionBasedOnSubtasks();
    } catch (error) {
      console.error("Error adding subtasks:", error);
      showErrorNotification("Failed to add subtasks. Please try again.");
    }
  };

  const createSubtaskNotifications = async (newSubtasks: any[]) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    for (const subtask of newSubtasks) {
      if (subtask.assigned_to && subtask.assigned_to !== currentUser.uid) {
        try {
          await addDoc(collection(db, "notifications"), {
            userId: subtask.assigned_to,
            taskId: currentTask.id,
            taskTitle: currentTask.title,
            subtaskId: subtask.id,
            subtaskText: subtask.text,
            type: "subtask_assigned",
            message: `You have been assigned a new subtask: "${subtask.text}" in task "${currentTask.title}"`,
            isRead: false,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.uid,
          });
        } catch (error) {
          console.error("Error creating notification:", error);
        }
      }
    }
  };

  const createSubtaskCompletionNotification = async (
    subtask: any,
    currentUser: any,
  ) => {
    try {
      // Notify task owner about subtask completion
      if (currentTask.ownerId && currentTask.ownerId !== currentUser.uid) {
        await addDoc(collection(db, "notifications"), {
          userId: currentTask.ownerId,
          taskId: currentTask.id,
          taskTitle: currentTask.title,
          subtaskId: subtask.id,
          subtaskText: subtask.text,
          completedBy: currentUser.uid,
          type: "subtask_completed",
          message: `Subtask "${subtask.text}" has been completed by ${currentUser.email || currentUser.uid}`,
          isRead: false,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.uid,
        });
      }
    } catch (error) {
      console.error("Error creating completion notification:", error);
    }
  };

  const getFileTypeIcon = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "pdf":
        return { icon: HiDocument, color: "#ef4444", label: "PDF" };
      case "doc":
      case "docx":
        return { icon: HiDocumentText, color: "#3b82f6", label: "DOC" };
      case "txt":
        return { icon: HiDocumentText, color: "#6b7280", label: "TXT" };
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "svg":
      case "webp":
        return { icon: HiPhoto, color: "#10b981", label: "IMG" };
      case "mp4":
      case "avi":
      case "mov":
      case "wmv":
        return { icon: HiVideoCamera, color: "#f59e0b", label: "VID" };
      case "xls":
      case "xlsx":
        return { icon: HiTableCells, color: "#10b981", label: "XLS" };
      case "ppt":
      case "pptx":
        return { icon: HiComputerDesktop, color: "#f59e0b", label: "PPT" };
      case "zip":
      case "rar":
      case "7z":
      case "tar":
      case "gz":
        return { icon: HiArchiveBox, color: "#8b5cf6", label: "ARCH" };
      default:
        return { icon: HiDocument, color: "#6b7280", label: "FILE" };
    }
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    // Allow all task participants (owner and collaborators) to upload files
    if (
      !isOwner &&
      !currentTask.collaborators?.includes(auth.currentUser?.uid || "")
    ) {
      showErrorNotification("Only task participants can upload files.");
      return;
    }

    setUploading(true);

    try {
      // For invited/shared tasks, `ref` points to the master task document.
      const uploadTaskId = currentTask.ref || currentTask.id || task.id;
      if (!uploadTaskId) {
        throw new Error("Task ID is missing");
      }

      await uploadTaskAttachment(uploadTaskId, file);
      showSuccessNotification("File uploaded successfully.");

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showErrorNotification("Failed to upload file. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const downloadFile = (attachment: any) => {
    // Create a temporary link element to trigger download
    const link = document.createElement("a");
    link.href = attachment.url;
    link.target = "_blank";
    link.download = getAttachmentDisplayName(attachment);
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const deleteFile = async (attachmentId: string) => {
    const currentUser = auth.currentUser;
    const targetAttachment = attachments.find((att) => att.id === attachmentId);
    const isAllowed = canDeleteFile(
      currentUser ? { id: currentUser.uid } : null,
      { ownerId: currentTask.ownerId || null },
      { uploadedBy: targetAttachment ? getAttachmentUploadedBy(targetAttachment) : null },
    );

    if (!isAllowed) {
      showErrorNotification("Only the task owner or file uploader can delete files.");
      return;
    }

    if (!confirm("Are you sure you want to delete this file?")) return;

    try {
      const deleteTaskId = currentTask.ref || currentTask.id || task.id;
      if (!deleteTaskId) {
        throw new Error("Task ID is missing");
      }
      await deleteTaskAttachment(deleteTaskId, attachmentId);
      showSuccessNotification("File deleted successfully.");
    } catch (error) {
      console.error("Error deleting file:", error);
      showErrorNotification("Failed to delete file. Please try again.");
    }
  };

  const handleProfileClick = (userId: string, role: string) => {
    const profile = profileData[userId];
    if (profile) {
      setSelectedProfile({
        id: userId,
        name: profile.username || profile.email || "Unknown User",
        email: profile.email || "No email",
        avatarUrl: profile.avatar_url,
        avatarData: profile.avatar_data,
        role: role,
      });
      setProfileModalOpen(true);
    }
  };

  const closeProfileModal = () => {
    setProfileModalOpen(false);
    setSelectedProfile(null);
  };

  const calculateProgress = () => {
    if (subtasks.length === 0) return 0;
    const completedCount = subtasks.filter((st) => st.completed).length;
    return Math.round((completedCount / subtasks.length) * 100);
  };

  // Calculate task completion based on subtask progress
  const getTaskCompletionStatus = () => {
    return calculateTaskCompletion(currentTask);
  };

  // Update task completion based on subtask progress
  const updateTaskCompletionBasedOnSubtasks = async () => {
    const shouldBeCompleted = getTaskCompletionStatus();
    const currentlyCompleted = currentTask.completed;

    // Only update if completion status should change
    if (shouldBeCompleted !== currentlyCompleted) {
      try {
        const taskRef = doc(db, "tasks", task.id);
        await updateDoc(taskRef, {
          completed: shouldBeCompleted,
          completed_at: shouldBeCompleted ? new Date().toISOString() : null,
        });
        console.log(
          `Task completion updated to ${shouldBeCompleted} based on subtask progress`,
        );
      } catch (error) {
        console.error("Error updating task completion:", error);
      }
    }
  };

  const canCompleteSubtask = (subtask: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return false;

    // Owner can complete any subtask
    if (isOwner) return true;

    // If subtask has an "owner" role, only that assigned owner can complete it
    if (subtask.role === "owner") {
      return subtask.assigned_to === currentUser.uid;
    }

    // For regular subtasks without owner role, assigned collaborators can complete
    return subtask.assigned_to === currentUser.uid;
  };

  const getSubtaskAssignee = (assignedTo: string | null | undefined) => {
    if (!assignedTo) return null;

    const profile = profileData[assignedTo];
    if (profile) {
      return profile.username || profile.email || "Unknown User";
    }

    // Fallback for when profile data is not loaded yet
    const currentUser = auth.currentUser;
    if (currentUser && assignedTo === currentUser.uid) {
      return "You";
    }

    // Check if this is the owner
    if (task.ownerId && assignedTo === task.ownerId) {
      return ownerLabel || "Task Owner";
    }

    // Check collaborator labels
    if (collaboratorLabels) {
      const collaboratorLabel = collaboratorLabels.find(
        (label: any) => label.id === assignedTo,
      );
      if (collaboratorLabel) {
        const labelData = collaboratorLabel as any;
        return labelData.name || labelData.email || "Unknown Collaborator";
      }
    }

    return "Unknown User";
  };

  const getStatusClass = () => {
    const isCompleted = getTaskCompletionStatus();
    if (isCompleted) return "task-status-completed";

    // Check if overdue
    if (task.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) return "task-status-overdue";
    }

    // Check progress level
    const progress = calculateProgress();
    if (progress > 0) return "task-status-in-progress";
    return "task-status-pending";
  };

  const getStatusText = () => {
    const isCompleted = getTaskCompletionStatus();
    if (isCompleted) return "Completed";

    // Check if overdue
    if (task.due_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      if (due < today) return "Overdue";
    }

    // Check progress level
    const progress = calculateProgress();
    if (progress > 0) return `In Progress (${progress}%)`;
    return "Pending";
  };

  const getPriorityClass = () => {
    switch (task.priority) {
      case "high":
        return "task-priority-high";
      case "medium":
        return "task-priority-medium";
      case "low":
        return "task-priority-low";
      default:
        return "task-priority-medium";
    }
  };

  return (
    <div className="task-details-fullscreen">
      <TaskHeader
        isOwner={isOwner}
        onBack={onBack}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      <div className="task-details-layout">
        <div className="task-details-main">
          {/* Task Title Section */}
          <section className="task-details-section-top">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h3 className="task-section-title" style={{ margin: 0 }}>
                Task Title
              </h3>
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                {task.shared && (
                  <div className="task-shared-indicator">
                    <HiShare className="task-shared-icon" />
                    <span>Shared</span>
                  </div>
                )}
                <button
                  className="task-comments-btn"
                  onClick={onOpenComments}
                  title="View Comments"
                >
                  <HiChatBubbleLeft />
                  <span>Comments</span>
                </button>
              </div>
            </div>
            <h1 className="task-details-title">{task.title}</h1>
            <div className="task-details-status">
              <div className="status-priority">
              <span className={`task-status-badge ${getStatusClass()}`}>
                {getStatusText()}
              </span>
                <div className="task-details-header-meta">
              <span className={`task-pill ${getPriorityClass()}`}>
                {task.priority?.toUpperCase() || "MEDIUM"}
              </span>
            </div>
            </div>
              {subtasks.length > 0 && (
                <div className="task-progress-info">
                  <div className="task-progress-bar">
                    <div
                      className="task-progress-fill"
                      style={{ width: `${calculateProgress()}%` }}
                    />
                    
                  </div>
                  <span className="task-progress-text">
                    {subtasks.filter((st) => st.completed).length} of{" "}
                    {subtasks.length} subtasks completed
                  </span>
                </div>
              )}
            </div>
            
          </section>

          {/* Team Members Section */}
          <section className="task-details-section-second">
            <h3 className="task-section-title">Team Members</h3>
            <div className="task-team-members">
              {/* Show owner first */}
              {task.ownerId && profileData[task.ownerId] && (
                <div
                  className="task-member-avatar"
                  onClick={() => handleProfileClick(task.ownerId!, "Owner")}
                  title={`${profileData[task.ownerId].username || profileData[task.ownerId].email} (Owner)`}
                >
                  {profileData[task.ownerId].avatar_data ||
                  profileData[task.ownerId].avatar_url ? (
                    <img
                      src={
                        profileData[task.ownerId].avatar_data ||
                        profileData[task.ownerId].avatar_url ||
                        ""
                      }
                      alt={
                        profileData[task.ownerId].username ||
                        profileData[task.ownerId].email
                      }
                    />
                  ) : (
                    (
                      profileData[task.ownerId].username ||
                      profileData[task.ownerId].email ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>
              )}

              {/* Show collaborators */}
              {task.collaborators &&
                task.collaborators.length > 0 &&
                task.collaborators.slice(0, 3).map((collaboratorId) => {
                  const profile = profileData[collaboratorId];
                  if (!profile) {
                    // Show fallback collaborator when profile data is missing
                    return (
                      <div
                        key={collaboratorId}
                        className="task-member-avatar"
                        onClick={() =>
                          handleProfileClick(collaboratorId, "Collaborator")
                        }
                        title={`User ${collaboratorId.slice(0, 8)} (Collaborator)`}
                      >
                        {`U${collaboratorId.slice(0, 8)}`}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={collaboratorId}
                      className="task-member-avatar"
                      onClick={() =>
                        handleProfileClick(collaboratorId, "Collaborator")
                      }
                      title={`${profile.username || profile.email} (Collaborator)`}
                    >
                      {profile.avatar_data || profile.avatar_url ? (
                        <img
                          src={profile.avatar_data || profile.avatar_url || ""}
                          alt={profile.username || profile.email}
                        />
                      ) : (
                        (profile.username || profile.email || "C")
                          .charAt(0)
                          .toUpperCase()
                      )}
                    </div>
                  );
                })}

              {/* Show more indicator if there are additional collaborators */}
              {task.collaborators && task.collaborators.length > 3 && (
                <div className="task-members-more">
                  +{task.collaborators.length - 3}
                </div>
              )}

              {/* Fallback if no data loaded yet */}
              {(!profileData || Object.keys(profileData).length === 0) && (
                <>
                  <div className="task-member-avatar">U</div>
                  <div className="task-member-avatar">T</div>
                  <div className="task-member-avatar">S</div>
                </>
              )}
            </div>
          </section>

          {/* Project Description Section */}
          <section className="task-details-section-third">
            <h3 className="task-section-title">Project Description</h3>
            <p className="task-description">
              {task.description ||
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."}
            </p>
          </section>

          {/* File & Links Section */}
          <section className="task-details-section">
            <h3 className="task-section-title">File & Links</h3>
            <div className="task-files-links">
              {attachments.length === 0 ? (
                <div className="no-files-container">
                  <div className="no-files-icon">
                    <HiDocument />
                  </div>
                  <p className="no-files-text">
                    No files attached to this task yet
                  </p>
                  <p className="no-files-subtext">
                    Upload files to share with task participants
                  </p>
                </div>
              ) : (
                attachments.map((attachment) => {
                  const displayName = getAttachmentDisplayName(attachment);
                  const fileIcon = getFileTypeIcon(displayName);
                  const IconComponent = fileIcon.icon;
                  const currentUser = auth.currentUser;
                  const showDeleteButton = canDeleteFile(
                    currentUser ? { id: currentUser.uid } : null,
                    { ownerId: currentTask.ownerId || null },
                    { uploadedBy: getAttachmentUploadedBy(attachment) },
                  );
                  return (
                    <div
                      key={attachment.id}
                      className="task-file-item"
                      onClick={() => downloadFile(attachment)}
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        className="task-file-icon"
                        style={{ color: fileIcon.color }}
                      >
                        <IconComponent />
                      </div>
                      <div className="task-file-info">
                        <div className="task-file-name">{displayName}</div>
                        <div className="task-file-meta">
                          <span className="task-file-size">
                            {((attachment.size || 0) / 1024).toFixed(1)} KB
                          </span>
                          <span className="task-file-type">
                            {fileIcon.label}
                          </span>
                        </div>
                      </div>
                      <div className="task-file-actions">
                        <button
                          className="task-file-action-btn download"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(attachment);
                          }}
                          title="Download file"
                        >
                          <HiArrowDownTray />
                        </button>
                        {showDeleteButton && (
                          <>
                            <button
                              className="task-file-action-btn delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFile(attachment.id);
                              }}
                              title="Delete file"
                            >
                              <HiTrash />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              {/* Enable upload for all task participants */}
              {(isOwner ||
                task.collaborators?.includes(auth.currentUser?.uid || "")) && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                    accept="*/*"
                  />
                  <button
                    className="task-add-file"
                    title={uploading ? "Uploading..." : "Add file"}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "+" : <HiPlus />}
                  </button>
                </>
              )}
            </div>
          </section>
          {/* Task List Section */}
          <section className="task-details-section">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 className="new-task-title" style={{ margin: 0 }}>
                Task
              </h3>
              {isOwner && (
                <span className="task-add-subtask" onClick={addNewSubtask}>
                  <span className="task-add-subtask-icon">
                    <HiPlus />
                  </span>
                  Add new task
                </span>
              )}
            </div>
            <div className="task-subtasks">
              {subtasks.length === 0 ? (
                <p
                  style={{ color: "var(--qt-text-soft)", fontStyle: "italic" }}
                >
                  No subtasks yet.{" "}
                  {isOwner && "Click 'Add new task' to create one."}
                </p>
              ) : (
                subtasks.map((subtask) => (
                  <div key={subtask.id} className="task-subtask-item">
                    <button
                      className={`task-subtask-checkbox ${subtask.completed ? "checked" : ""} ${!canCompleteSubtask(subtask) ? "disabled" : ""}`}
                      onClick={() => toggleSubtask(subtask.id)}
                      disabled={!canCompleteSubtask(subtask)}
                      title={
                        !canCompleteSubtask(subtask)
                          ? subtask.assigned_to
                            ? "This subtask is assigned to someone else"
                            : "This subtask is not assigned to anyone"
                          : "Toggle completion"
                      }
                    >
                      {subtask.completed && <HiCheck />}
                    </button>
                    <span
                      className={`task-subtask-text ${subtask.completed ? "completed" : ""}`}
                    >
                      {subtask.text}
                    </span>
                    {subtask.assigned_to && (
                      <span className="subtask-assigned-person">
                        Assigned to: {getSubtaskAssignee(subtask.assigned_to)}
                      </span>
                    )}
                    {subtask.role && (
                      <span className="subtask-role">Role: {subtask.role}</span>
                    )}
                    {subtask.due_date && !subtask.completed && (
                      <span className="subtask-due-date">
                        Due: {new Date(subtask.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {subtask.completed && subtask.completed_at && (
                      <span className="subtask-completed-date">
                        Completed:{" "}
                        {new Date(subtask.completed_at).toLocaleDateString()}
                      </span>
                    )}
                    {subtask.completed_by && (
                      <span className="subtask-completed-by">
                        Completed by: {getSubtaskAssignee(subtask.completed_by)}
                      </span>
                    )}
                    {isOwner && (
                      <button
                        className="subtask-delete-btn"
                        onClick={() => requestDeleteSubtask(subtask.id)}
                        title="Delete subtask"
                      >
                        <HiTrash />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Task Information Section */}
          <section className="task-details-section">
            <h3 className="task-info-title">Task Information</h3>
            <div className="task-info-grid">
              {task.due_date && (
                <div className="task-info-item">
                  <HiCalendar className="task-info-icon" />
                  <div className="task-info-content">
                    <span className="task-info-label">Due Date</span>
                    <span className="task-info-value">
                      {new Date(task.due_date).toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              )}

              <div className="task-info-item">
                <HiClock className="task-info-icon" />
                <div className="task-info-content">
                  <span className="task-info-label">Created</span>
                  <span className="task-info-value">
                    {new Date(task.created_at).toLocaleDateString(undefined, {
                      weekday: "short",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </div>

              <div className="task-info-item">
                <HiUserCircle className="task-info-icon" />
                <div className="task-info-content">
                  <span className="task-info-label">Your Role</span>
                  <span className="task-info-value">
                    {roleLabel || "Viewer"}
                  </span>
                </div>
              </div>

              {task.assigned_to && (
                <div className="task-info-item">
                  <HiUserPlus className="task-info-icon" />
                  <div className="task-info-content">
                    <span className="task-info-label">Assigned To</span>
                    <span className="task-info-value">
                      {task.assigned_to === auth.currentUser?.uid
                        ? "You"
                        : getSubtaskAssignee(task.assigned_to) ||
                          "Unknown User"}
                    </span>
                  </div>
                </div>
              )}

              <div className="task-info-item">
                <HiCheckCircle className="task-info-icon" />
                <div className="task-info-content">
                  <span className="task-info-label">Completed Tasks</span>
                  <span className="task-info-value">
                    {subtasks.filter((st) => st.completed).length} /{" "}
                    {subtasks.length}
                  </span>
                </div>
              </div>

              {subtasks.length > 0 && (
                <div className="task-info-item task-info-item-progress">
                  <div className="task-info-icon">
                    <div className="progress-indicator">
                      <div
                        className="progress-circle"
                        style={{
                          background: `conic-gradient(#78d957 ${calculateProgress() * 3.6}deg, rgba(51, 65, 85, 0.5) 0deg)`,
                        }}
                      >
                        <span className="progress-text-small">
                          {calculateProgress()}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="task-info-content">
                    <span className="task-info-label">Progress</span>
                    <span className="task-info-value">
                      {calculateProgress()}% Complete
                    </span>
                  </div>
                </div>
              )}
            </div>

            {isOwner && (
              <div className="task-info-actions">
                <button
                  className="task-info-btn"
                  onClick={onInviteCollaborator}
                >
                  <HiUserPlus style={{ marginRight: "8px" }} />
                  Invite Collaborators
                </button>
              </div>
            )}

            {isOwner && (
              <div className="task-info-actions">
                <button className="task-info-btn" onClick={handleDeleteTask}>
                  <HiTrash style={{ marginRight: "8px" }} />
                  Delete Task
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={closeProfileModal}
        profile={selectedProfile}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="delete-modal-header">
              <h3>Delete Task</h3>
            </div>
            <p>
              Are you sure you want to delete this task? This action cannot be
              undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={cancelDeleteTask}>
                <HiXMark className="cancel-animation" />
                <span>Cancel</span>
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteTask}>
                <HiTrash className="trash-animation" />
                <span>Delete Task</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtask Delete Confirmation Modal */}
      {subtaskToDeleteId && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="delete-modal-header">
              <h3>Delete Subtask</h3>
            </div>
            <p>
              Are you sure you want to delete this subtask? This action cannot
              be undone.
            </p>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={cancelDeleteSubtask}>
                <HiXMark className="cancel-animation" />
                <span>Cancel</span>
              </button>
              <button className="btn btn-danger" onClick={confirmDeleteSubtask}>
                <HiTrash className="trash-animation" />
                <span>Delete Subtask</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Notification */}
      <NotificationBanner notification={notification} />

      {/* Subtask Modal */}
      <SubtaskModal
        isOpen={subtaskModalOpen}
        onClose={() => setSubtaskModalOpen(false)}
        onSuccess={handleSubtasksCreated}
        existingCollaborators={
          task.collaborators?.map((id) => ({
            id,
            name:
              profileData[id]?.username ||
              profileData[id]?.email ||
              collaboratorLabels?.find((label) => label === id) ||
              "Unknown",
            email: profileData[id]?.email || "",
            role: "collaborator",
          })) || []
        }
        taskDueDate={task.due_date}
      />
    </div>
  );
}
