import { adminDb } from "../utils/firebase.js";

function daysUntil(dateIso) {
  if (!dateIso) return null;
  const today = new Date();
  const target = new Date(dateIso);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

async function computeRuleBasedPriorityScore(task, userId) {
  let score = 0;

  const days = daysUntil(task.due_date);
  if (days !== null) {
    if (days < 0) score += 40;
    else if (days === 0) score += 30;
    else if (days <= 2) score += 20;
    else if (days <= 7) score += 10;
  }

  if (task.category === "Work") score += 10;
  if (task.category === "Urgent") score += 20;

  const completedSnap = await adminDb
    .collection("tasks")
    .where("user_id", "==", userId)
    .where("completed", "==", true)
    .limit(100)
    .get();

  let overdueCount = 0;
  let similarCount = 0;

  completedSnap.forEach((d) => {
    const t = d.data();
    if (t.completed_at && t.due_date && t.completed_at > t.due_date) {
      overdueCount += 1;
    }
    if (
      task.category &&
      t.category === task.category &&
      typeof t.title === "string" &&
      typeof task.title === "string" &&
      t.title.toLowerCase().includes(task.title.toLowerCase().slice(0, 5))
    ) {
      similarCount += 1;
    }
  });

  score += Math.min(similarCount * 2, 20);
  score += Math.min(overdueCount * 1, 15);

  return score;
}

function scoreToPriority(score) {
  if (score >= 60) return "high";
  if (score >= 30) return "medium";
  return "low";
}

export async function suggestTaskPriority(taskId, userId) {
  const snap = await adminDb.collection("tasks").doc(taskId).get();
  if (!snap.exists) {
    throw new Error("Task not found");
  }
  const task = snap.data() || {};

  const score = await computeRuleBasedPriorityScore(task, userId);
  const priority = scoreToPriority(score);

  return {
    priority,
    score,
    reason: `Rule-based score ${score} from due date, category, and history.`,
  };
}

function guessRecurrenceFromIntervals(intervals) {
  if (!intervals.length) return { type: "none", confidence: 0 };
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  if (Math.abs(avg - 1) <= 0.5) return { type: "daily", confidence: 0.8 };
  if (Math.abs(avg - 7) <= 1.5) return { type: "weekly", confidence: 0.8 };
  if (Math.abs(avg - 30) <= 5) return { type: "monthly", confidence: 0.7 };

  return { type: "none", confidence: 0.3 };
}

export async function predictTaskPatterns(userId) {
  const snap = await adminDb
    .collection("tasks")
    .where("user_id", "==", userId)
    .where("completed", "==", true)
    .orderBy("created_at", "asc")
    .limit(300)
    .get();

  const completed = [];
  snap.forEach((d) => completed.push({ id: d.id, ...d.data() }));

  const byTitleKey = new Map();
  for (const t of completed) {
    const key =
      typeof t.title === "string"
        ? t.title.toLowerCase().slice(0, 10)
        : "other";
    if (!byTitleKey.has(key)) byTitleKey.set(key, []);
    byTitleKey.get(key).push(t);
  }

  const recurrent = [];
  for (const [key, tasks] of byTitleKey) {
    if (tasks.length < 3) continue;
    const dates = tasks
      .map((t) => new Date(t.created_at || t.due_date || t.completed_at || ""))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length < 3) continue;

    const intervals = [];
    for (let i = 1; i < dates.length; i += 1) {
      const diffDays =
        (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
      intervals.push(diffDays);
    }

    const { type, confidence } = guessRecurrenceFromIntervals(intervals);
    if (type !== "none") {
      recurrent.push({
        patternKey: key,
        recurrence: type,
        confidence,
        sampleTaskTitle: tasks[0].title ?? "Untitled task",
      });
    }
  }

  let totalDuration = 0;
  let durationCount = 0;
  for (const t of completed) {
    if (!t.created_at || !t.completed_at) continue;
    const created = new Date(t.created_at);
    const done = new Date(t.completed_at);
    if (Number.isNaN(created.getTime()) || Number.isNaN(done.getTime())) {
      continue;
    }
    const days = (done.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 0 && days < 180) {
      totalDuration += days;
      durationCount += 1;
    }
  }

  let suggestedDeadlineDays = null;
  let deadlineConfidence = 0;
  if (durationCount > 3) {
    suggestedDeadlineDays = totalDuration / durationCount;
    deadlineConfidence = 0.7;
  }

  return {
    recurrentSuggestions: recurrent,
    deadlineSuggestion: suggestedDeadlineDays
      ? {
          averageDaysToComplete: suggestedDeadlineDays,
          confidence: deadlineConfidence,
        }
      : null,
  };
}
