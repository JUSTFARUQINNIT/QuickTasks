import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "../utils/firebase.js";

const db = getFirestore();

export default async function taskManagerRoutes(req, res) {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({ error: "Task ID is required" });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  let decodedToken;
  
  try {
    decodedToken = await getAuth().verifyIdToken(token);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }

  const userId = decodedToken.uid;

  try {
    // Get the task to verify ownership
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    
    if (!taskSnap.exists) {
      return res.status(404).json({ error: "Task not found" });
    }

    const taskData = taskSnap.data();
    
    // Check if user is owner or collaborator
    const isOwner = taskData.user_id === userId;
    const isCollaborator = taskData.collaborators?.includes(userId);
    
    if (!isOwner && !isCollaborator) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case "POST":
        return await handlePostRequest(req, res, taskRef, taskData, isOwner, userId);
      case "PUT":
        return await handlePutRequest(req, res, taskRef, taskData, isOwner, userId);
      case "DELETE":
        return await handleDeleteRequest(req, res, taskRef, taskData, isOwner, userId);
      default:
        return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (error) {
    console.error("Task manager error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function handlePostRequest(req, res, taskRef, taskData, isOwner, userId) {
  const { type, data } = req.body;

  switch (type) {
    case "subtask":
      if (!isOwner) {
        return res.status(403).json({ error: "Only owners can add subtasks" });
      }
      
      const newSubtask = {
        id: Date.now().toString(),
        text: data.text,
        completed: false,
        created_at: new Date().toISOString()
      };
      
      await taskRef.update({
        subtasks: FieldValue.arrayUnion(newSubtask)
      });
      
      return res.json({ success: true, subtask: newSubtask });

    case "attachment":
      if (!isOwner) {
        return res.status(403).json({ error: "Only owners can add attachments" });
      }
      
      const newAttachment = {
        id: Date.now().toString(),
        name: data.name,
        type: data.type,
        size: data.size,
        url: data.url,
        uploaded_by: req.userId,
        uploaded_at: new Date().toISOString()
      };
      
      await taskRef.update({
        attachments: FieldValue.arrayUnion(newAttachment)
      });
      
      return res.json({ success: true, attachment: newAttachment });

    default:
      return res.status(400).json({ error: "Invalid type" });
  }
}

async function handlePutRequest(req, res, taskRef, taskData, isOwner, userId) {
  const { type, data } = req.body;

  switch (type) {
    case "subtask":
      // Check if user is owner or the assigned subtask owner
      const targetSubtask = (taskData.subtasks || []).find(subtask => subtask.id === data.id);
      const isSubtaskOwner = targetSubtask?.assigned_to === userId && targetSubtask?.role === "owner";
      
      if (!isOwner && !isSubtaskOwner) {
        return res.status(403).json({ error: "Only task owners or assigned subtask owners can update subtasks" });
      }
      
      const updatedSubtasks = (taskData.subtasks || []).map(subtask =>
        subtask.id === data.id ? { 
          ...subtask, 
          completed: data.completed,
          completed_by: data.completed ? userId : null,
          completed_at: data.completed ? new Date().toISOString() : null
        } : subtask
      );
      
      // Calculate progress and auto-complete task if 100%
      const completedCount = updatedSubtasks.filter(st => st.completed).length;
      const totalCount = updatedSubtasks.length;
      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      
      const updateData = { subtasks: updatedSubtasks };
      
      // Auto-mark task as completed when 100% progress
      if (progress === 100 && !taskData.completed) {
        updateData.completed = true;
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = userId;
      } else if (progress < 100 && taskData.completed) {
        updateData.completed = false;
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
      
      await taskRef.update(updateData);
      
      return res.json({ success: true });

    default:
      return res.status(400).json({ error: "Invalid type" });
  }
}

async function handleDeleteRequest(req, res, taskRef, taskData, isOwner, userId) {
  const { type, id } = req.query;

  switch (type) {
    case "subtask":
      if (!isOwner) {
        return res.status(403).json({ error: "Only owners can delete subtasks" });
      }
      
      const updatedSubtasks = (taskData.subtasks || []).filter(subtask => subtask.id !== id);
      await taskRef.update({ subtasks: updatedSubtasks });
      
      return res.json({ success: true });

    case "attachment":
      if (!isOwner) {
        return res.status(403).json({ error: "Only owners can delete attachments" });
      }
      
      const updatedAttachments = (taskData.attachments || []).filter(attachment => attachment.id !== id);
      await taskRef.update({ attachments: updatedAttachments });
      
      return res.json({ success: true });

    default:
      return res.status(400).json({ error: "Invalid type" });
  }
}
