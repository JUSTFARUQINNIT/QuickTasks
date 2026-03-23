import type { Task } from "../types/tasks";

// Define a base type that works with both Task and TaskSummary
type BaseTask = {
  completed: boolean;
  subtasks?: any[];
};

/**
 * Calculate task completion based on subtask progress
 * @param task - The task to evaluate (Task or TaskSummary)
 * @returns boolean - Whether the task should be considered complete
 */
export function calculateTaskCompletion(task: BaseTask): boolean {
  const subtasks = task.subtasks || [];

  // If no subtasks, use the task's completed status
  if (subtasks.length === 0) {
    return task.completed;
  }

  // Calculate progress
  const completedCount = subtasks.filter((st) => st.completed).length;
  const progress = Math.round((completedCount / subtasks.length) * 100);

  // Task is considered complete if 100% of subtasks are completed
  return progress === 100;
}

/**
 * Calculate subtask progress percentage
 * @param task - The task to evaluate (Task or TaskSummary)
 * @returns number - Progress percentage (0-100)
 */
export function calculateSubtaskProgress(task: BaseTask): number {
  const subtasks = task.subtasks || [];

  if (subtasks.length === 0) return 0;

  const completedCount = subtasks.filter((st) => st.completed).length;
  return Math.round((completedCount / subtasks.length) * 100);
}

/**
 * Get task status based on completion and subtask progress
 * @param task - The task to evaluate (Task type with due_date)
 * @returns string - Status label
 */
export function getTaskStatus(
  task: Task & { due_date?: string | null },
): "completed" | "pending" | "overdue" {
  const isCompleted = calculateTaskCompletion(task);

  if (isCompleted) {
    return "completed";
  }

  // Check if overdue
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);

    if (due < today) {
      return "overdue";
    }
  }

  return "pending";
}
