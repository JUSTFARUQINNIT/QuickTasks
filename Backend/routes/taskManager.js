import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { adminDb } from "../utils/firebase.js";

const db = adminDb; // Use adminDb directly for full admin privileges

export default async function taskManagerRoutes(req, res) {
  console.log(`📥 TaskManager route hit: ${req.method} ${req.originalUrl}`);
  
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

  // Handle HTTP methods
  if (req.method === "DELETE") {
    return await handleCascadeDelete(req, res, taskId, userId);
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
        return await handlePostRequest(
          req,
          res,
          taskRef,
          taskData,
          isOwner,
          userId,
        );
      case "PUT":
        return await handlePutRequest(
          req,
          res,
          taskRef,
          taskData,
          isOwner,
          userId,
        );
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
        created_at: new Date().toISOString(),
      };

      await taskRef.update({
        subtasks: FieldValue.arrayUnion(newSubtask),
      });

      return res.json({ success: true, subtask: newSubtask });

    case "attachment":
      if (!isOwner) {
        return res
          .status(403)
          .json({ error: "Only owners can add attachments" });
      }

      const newAttachment = {
        id: Date.now().toString(),
        name: data.name,
        type: data.type,
        size: data.size,
        url: data.url,
        uploaded_by: req.userId,
        uploaded_at: new Date().toISOString(),
      };

      await taskRef.update({
        attachments: FieldValue.arrayUnion(newAttachment),
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
      const targetSubtask = (taskData.subtasks || []).find(
        (subtask) => subtask.id === data.id,
      );
      const isSubtaskOwner =
        targetSubtask?.assigned_to === userId &&
        targetSubtask?.role === "owner";

      if (!isOwner && !isSubtaskOwner) {
        return res
          .status(403)
          .json({
            error:
              "Only task owners or assigned subtask owners can update subtasks",
          });
      }

      const updatedSubtasks = (taskData.subtasks || []).map((subtask) =>
        subtask.id === data.id
          ? {
              ...subtask,
              completed: data.completed,
              completed_by: data.completed ? userId : null,
              completed_at: data.completed ? new Date().toISOString() : null,
            }
          : subtask,
      );

      // Calculate progress and auto-complete task if 100%
      const completedCount = updatedSubtasks.filter(
        (st) => st.completed,
      ).length;
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

async function handleCascadeDelete(req, res, taskId, userId) {
  try {
    console.log(`🗑️ Cascade delete requested for task ${taskId} by user ${userId}`);
    
    // Get task to verify ownership
    const taskRef = db.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      console.log(`❌ Task ${taskId} not found`);
      return res.status(404).json({ error: "Task not found" });
    }

    const taskData = taskSnap.data();
    console.log(`📋 Task found:`, { 
      title: taskData.title, 
      owner: taskData.user_id, 
      collaborators: taskData.collaborators 
    });
    
    // Only allow original owner to delete the task
    if (taskData.user_id !== userId) {
      console.log(`🚫 User ${userId} is not owner (owner: ${taskData.user_id})`);
      return res.status(403).json({ error: "Only task owner can delete this task" });
    }

    console.log(`✅ User ${userId} confirmed as owner, proceeding with cascade deletion`);

    // Perform cascade deletion with admin privileges
    const deletePromises = [];
    const deletedPaths = [];

    // 1. Delete the main task
    console.log(`🗑️ Deleting main task ${taskId}`);
    deletePromises.push(taskRef.delete());
    deletedPaths.push(`tasks/${taskId}`);

    // 2. Delete from owner's userTasks
    const ownerUserTaskRef = db.collection("userTasks").doc(userId).collection("tasks").doc(taskId);
    console.log(`🗑️ Deleting from owner's userTasks: userTasks/${userId}/tasks/${taskId}`);
    deletePromises.push(ownerUserTaskRef.delete());
    deletedPaths.push(`userTasks/${userId}/tasks/${taskId}`);

    // 3. Delete from all collaborators' userTasks
    if (taskData.collaborators && Array.isArray(taskData.collaborators)) {
      console.log(`🗑️ Deleting from ${taskData.collaborators.length} collaborators' userTasks`);
      taskData.collaborators.forEach((collaboratorId) => {
        const collaboratorUserTaskRef = db.collection("userTasks").doc(collaboratorId).collection("tasks").doc(taskId);
        console.log(`🗑️ Deleting from collaborator ${collaboratorId}: userTasks/${collaboratorId}/tasks/${taskId}`);
        deletePromises.push(collaboratorUserTaskRef.delete());
        deletedPaths.push(`userTasks/${collaboratorId}/tasks/${taskId}`);
      });
    }

    // 4. Find and delete all userTasks references to this task (comprehensive cleanup)
    console.log(`🗑️ Searching for all userTasks references to task ${taskId}`);
    try {
      // Query all userTasks subcollections for this task ID
      const allUserTasksCollections = await db.collection("userTasks").listDocuments();
      
      for (const userDoc of allUserTasksCollections) {
        try {
          const userTasksRef = userDoc.collection("tasks");
          const taskDoc = await userTasksRef.doc(taskId).get();
          
          if (taskDoc.exists) {
            console.log(`🗑️ Found additional reference: userTasks/${userDoc.id}/tasks/${taskId}`);
            deletePromises.push(taskDoc.ref.delete());
            deletedPaths.push(`userTasks/${userDoc.id}/tasks/${taskId}`);
          }
        } catch (err) {
          console.log(`⚠️ Could not check userTasks for user ${userDoc.id}:`, err.message);
        }
      }
    } catch (err) {
      console.log(`⚠️ Could not list userTasks collections:`, err.message);
    }

    // 5. Also try collectionGroup query as backup
    try {
      console.log(`🗑️ Running collectionGroup cleanup query`);
      const allUserTasksQuery = await db.collectionGroup("tasks").where("ref", "==", taskId).get();
      allUserTasksQuery.forEach((doc) => {
        console.log(`🗑️ Found collectionGroup reference: ${doc.ref.path}`);
        deletePromises.push(doc.ref.delete());
        deletedPaths.push(doc.ref.path);
      });
    } catch (err) {
      console.log(`⚠️ CollectionGroup query failed:`, err.message);
    }

    // Execute all deletions
    console.log(`🗑️ Executing ${deletePromises.length} deletion operations`);
    const results = await Promise.allSettled(deletePromises);
    
    // Check for failures
    const failures = results.filter(r => r.status === 'rejected');
    const successes = results.filter(r => r.status === 'fulfilled');
    
    console.log(`✅ ${successes.length} deletions successful, ${failures.length} failed`);
    
    if (failures.length > 0) {
      console.error(`❌ Deletion failures:`, failures.map(f => f.reason));
      // Don't fail the entire operation if some deletions fail, as long as the main task is deleted
    }

    console.log(`✅ Cascade deletion completed. Deleted paths:`, deletedPaths);
    return res.json({ 
      success: true, 
      message: "Task and all shared copies deleted successfully",
      deletedCount: successes.length,
      failedCount: failures.length,
      deletedPaths: deletedPaths
    });
  } catch (error) {
    console.error("❌ Cascade delete error:", error);
    return res.status(500).json({ error: "Failed to delete task: " + error.message });
  }
}

async function handleDeleteRequest(
  req,
  res,
  taskRef,
  taskData,
  isOwner,
  userId,
) {
  const { type, id } = req.query;

  switch (type) {
    case "subtask":
      if (!isOwner) {
        return res
          .status(403)
          .json({ error: "Only owners can delete subtasks" });
      }

      const updatedSubtasks = (taskData.subtasks || []).filter(
        (subtask) => subtask.id !== id,
      );
      await taskRef.update({ subtasks: updatedSubtasks });

      return res.json({ success: true });

    case "attachment":
      if (!isOwner) {
        return res
          .status(403)
          .json({ error: "Only owners can delete attachments" });
      }

      const updatedAttachments = (taskData.attachments || []).filter(
        (attachment) => attachment.id !== id,
      );
      await taskRef.update({ attachments: updatedAttachments });

      return res.json({ success: true });

    default:
      return res.status(400).json({ error: "Invalid type" });
  }
}
