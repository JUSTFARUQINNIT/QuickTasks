export type OfflineTaskAction =
  | {
      id: string;
      type: "create";
      payload: {
        tempId: string;
        task: Record<string, unknown>;
      };
      createdAt: number;
    }
  | {
      id: string;
      type: "update";
      payload: {
        id: string;
        updates: Record<string, unknown>;
      };
      createdAt: number;
    }
  | {
      id: string;
      type: "delete";
      payload: { id: string };
      createdAt: number;
    }
  | {
      id: string;
      type: "reorder";
      payload: { orders: Array<{ id: string; order: number }> };
      createdAt: number;
    };

const CACHED_TASKS_KEY = "cached_tasks";
const LEGACY_CACHED_TASKS_KEY = "qt:tasks";
const OFFLINE_QUEUE_KEY = "offline_task_queue";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readCachedTasks<T>(): T[] {
  const fromNewKey = safeJsonParse<T[]>(localStorage.getItem(CACHED_TASKS_KEY));
  if (Array.isArray(fromNewKey)) return fromNewKey;

  const fromOldKey = safeJsonParse<T[]>(
    localStorage.getItem(LEGACY_CACHED_TASKS_KEY),
  );
  if (Array.isArray(fromOldKey)) return fromOldKey;

  return [];
}

export function writeCachedTasks<T>(tasks: T[]) {
  try {
    localStorage.setItem(CACHED_TASKS_KEY, JSON.stringify(tasks));
    // Backward compatible with existing cache.
    localStorage.setItem(LEGACY_CACHED_TASKS_KEY, JSON.stringify(tasks));
  } catch {
    // ignore write errors
  }
}

export function readOfflineQueue(): OfflineTaskAction[] {
  const parsed = safeJsonParse<OfflineTaskAction[]>(
    localStorage.getItem(OFFLINE_QUEUE_KEY),
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function writeOfflineQueue(queue: OfflineTaskAction[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore write errors
  }
}

export function enqueueOfflineAction(
  action: Omit<OfflineTaskAction, "id" | "createdAt">,
) {
  const queue = readOfflineQueue();

  const id =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `q_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const item: OfflineTaskAction = {
    ...(action as OfflineTaskAction),
    id,
    createdAt: Date.now(),
  };

  writeOfflineQueue([...queue, item]);
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // ignore remove errors
  }
}
