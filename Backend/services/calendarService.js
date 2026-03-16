import { google } from "googleapis";
import { adminDb } from "../utils/firebase.js";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} = process.env;

function getOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth env vars not configured");
  }
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
}

export function generateGoogleAuthUrl(userId) {
  const oauth2Client = getOAuth2Client();
  const scopes = ["https://www.googleapis.com/auth/calendar"];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: userId,
    prompt: "consent",
  });

  return url;
}

export async function handleGoogleCallback(code, userIdFromState) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  await adminDb
    .collection("calendar_tokens")
    .doc(userIdFromState)
    .set(
      {
        provider: "google",
        tokens,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );

  return true;
}

async function getAuthorizedCalendarClient(userId) {
  const doc = await adminDb
    .collection("calendar_tokens")
    .doc(userId)
    .get();
  if (!doc.exists) throw new Error("Google Calendar not connected");

  const data = doc.data() || {};
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(data.tokens);

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function syncTaskToGoogleCalendar(taskId) {
  const snap = await adminDb.collection("tasks").doc(taskId).get();
  if (!snap.exists) throw new Error("Task not found");
  const task = snap.data() || {};
  const userId = task.user_id;
  if (!userId) throw new Error("Task has no owner");

  if (!task.due_date) {
    throw new Error("Task has no due_date to sync");
  }

  const calendarClient = await getAuthorizedCalendarClient(userId);

  const date = task.due_date;
  const summary =
    typeof task.title === "string" ? task.title : "QuickTasks task";
  const description =
    typeof task.description === "string" ? task.description : "";

  const event = {
    summary,
    description,
    start: { date },
    end: { date },
  };

  const existingEventId = task.googleEventId;

  let apiRes;
  if (existingEventId) {
    apiRes = await calendarClient.events.update({
      calendarId: "primary",
      eventId: existingEventId,
      requestBody: event,
    });
  } else {
    apiRes = await calendarClient.events.insert({
      calendarId: "primary",
      requestBody: event,
    });
    const newId = apiRes.data.id;
    await snap.ref.update({ googleEventId: newId });
  }

  return apiRes.data;
}

export async function deleteTaskEventFromGoogle(taskId) {
  const snap = await adminDb.collection("tasks").doc(taskId).get();
  if (!snap.exists) return;
  const task = snap.data() || {};
  const userId = task.user_id;
  const eventId = task.googleEventId;
  if (!userId || !eventId) return;

  const calendarClient = await getAuthorizedCalendarClient(userId);
  await calendarClient.events.delete({
    calendarId: "primary",
    eventId,
  });

  await snap.ref.update({ googleEventId: null });
}

