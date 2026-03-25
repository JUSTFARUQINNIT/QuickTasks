import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { auth, db } from "../lib/firebaseClient";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

type Profile = {
  id: string;
  email: string;
  username: string | null;
  avatar_url: string | null;
  avatar_data: string | null;
  notifications_enabled?: boolean | null;
  notification_in_app?: boolean | null;
  notification_email?: boolean | null;
};

import { Avatar } from "./Avatar";

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string>("");
  const [avatarData, setAvatarData] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [notificationInApp, setNotificationInApp] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [passwordResetSending, setPasswordResetSending] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState<
    string | null
  >(null);

  const avatarPreviewUrl = useMemo(
    () => avatarObjectUrl || avatarData || avatarUrl || "",
    [avatarObjectUrl, avatarData, avatarUrl],
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const user = auth.currentUser;
        if (!user)
          throw new Error("You must be signed in to view your profile.");

        const storedTheme =
          (localStorage.getItem("qt:theme") as "dark" | "light" | null) ?? null;
        const initialTheme = storedTheme === "light" ? "light" : "dark";
        setTheme(initialTheme);
        document.documentElement.dataset.theme = initialTheme;

        const storedInApp = localStorage.getItem("qt:notification_in_app");
        const storedEmail = localStorage.getItem("qt:notification_email");
        if (storedInApp === "true") setNotificationInApp(true);
        if (storedEmail === "true") setNotificationEmail(true);

        const ref = doc(db, "profiles", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          const next: Omit<Profile, "id"> = {
            email: user.email ?? "Unknown user",
            username: null,
            avatar_url: null,
            avatar_data: null,
            notifications_enabled: true,
            notification_in_app: notificationInApp,
            notification_email: notificationEmail,
          };
          await setDoc(ref, next);
          if (!isMounted) return;
          const p: Profile = { id: user.uid, ...next };
          setProfile(p);
          setUsername(p.username ?? "");
          setAvatarUrl(p.avatar_url ?? "");
          setAvatarData(p.avatar_data ?? "");
          return;
        }

        if (!isMounted) return;

        const data = snap.data() as Omit<Profile, "id">;
        const p: Profile = { id: user.uid, ...data };
        setProfile(p);
        setUsername(p.username ?? "");
        setAvatarUrl(p.avatar_url ?? "");
        setAvatarData(p.avatar_data ?? "");
        if (typeof p.notification_in_app === "boolean") {
          setNotificationInApp(p.notification_in_app);
        }
        if (typeof p.notification_email === "boolean") {
          setNotificationEmail(p.notification_email);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not load profile.";
        if (!isMounted) return;
        setError(message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!avatarFile) return;
    const nextUrl = URL.createObjectURL(avatarFile);
    setAvatarObjectUrl(nextUrl);
    return () => {
      URL.revokeObjectURL(nextUrl);
    };
  }, [avatarFile]);

  useEffect(() => {
    if (!avatarFile && avatarObjectUrl) setAvatarObjectUrl("");
  }, [avatarFile, avatarObjectUrl]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [message]);

  useEffect(() => {
    if (!passwordResetMessage) return;
    const id = window.setTimeout(() => setPasswordResetMessage(null), 5000);
    return () => window.clearTimeout(id);
  }, [passwordResetMessage]);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Could not read file."));
      };
      reader.onerror = () =>
        reject(reader.error ?? new Error("Could not read file."));
      reader.readAsDataURL(file);
    });
  }

  async function handleToggleInApp(next: boolean) {
    setError(null);
    setMessage(null);

    if (next) {
      if (!("Notification" in window)) {
        setError("In-app notifications are not supported in this browser.");
        setNotificationInApp(false);
        localStorage.setItem("qt:notification_in_app", "false");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        setNotificationInApp(false);
        localStorage.setItem("qt:notification_in_app", "false");
        return;
      }
    }

    setNotificationInApp(next);
    localStorage.setItem("qt:notification_in_app", next ? "true" : "false");
  }

  function handleToggleEmail(next: boolean) {
    setNotificationEmail(next);
    localStorage.setItem("qt:notification_email", next ? "true" : "false");
  }

  function handleToggleTheme(next: "dark" | "light") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("qt:theme", next);
  }

  async function handleRequestPasswordReset() {
    if (!profile?.email) {
      setError("No email on your account. Cannot send reset link.");
      return;
    }
    setPasswordResetSending(true);
    setPasswordResetMessage(null);
    setError(null);
    try {
      const rawBase =
        (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const apiBase = rawBase.replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/auth/request-password-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profile.email }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          body?.error ?? "Could not send reset email. Please try again.",
        );
      }
      setPasswordResetMessage(
        "Password reset email sent. Check your inbox and use the link to set a new password.",
      );
    } catch (err) {
      console.error("Profile reset password error (backend):", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Could not send reset email. Please try again.";
      setPasswordResetMessage(msg);
    } finally {
      setPasswordResetSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const user = auth.currentUser;
      if (!user)
        throw new Error("You must be signed in to update your profile.");

      let nextAvatarData = avatarData;
      if (avatarFile) {
        nextAvatarData = await fileToDataUrl(avatarFile);
      } else if (!avatarData && avatarUrl.trim()) {
        // allow storing a direct URL if user chooses
        nextAvatarData = avatarUrl.trim();
      }

      localStorage.setItem("qt:theme", theme);
      localStorage.setItem(
        "qt:notification_in_app",
        notificationInApp ? "true" : "false",
      );
      localStorage.setItem(
        "qt:notification_email",
        notificationEmail ? "true" : "false",
      );

      const ref = doc(db, "profiles", user.uid);
      await updateDoc(ref, {
        email: user.email ?? null,
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        avatar_data: nextAvatarData || null,
        notifications_enabled: notificationInApp,
        notification_in_app: notificationInApp,
        notification_email: notificationEmail,
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              email: user.email ?? prev.email,
              username: username.trim() || null,
              avatar_url: avatarUrl.trim() || null,
              avatar_data: nextAvatarData || null,
              notification_in_app: notificationInApp,
              notification_email: notificationEmail,
            }
          : prev,
      );
      setAvatarData(nextAvatarData || "");
      setAvatarFile(null);
      setMessage("Profile updated.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not update profile.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  const displayName = profile?.username || profile?.email || "Your profile";

  return (
    <div className="profile-shell">
      <section className="profile-card">
        {loading ? (
          <div className="tasks-empty">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="profile-header">
              <div className="profile-avatar">
                <Avatar 
                  src={avatarPreviewUrl} 
                  alt={displayName} 
                  size={80} 
                />
              </div>
              <div>
                <h2 className="profile-heading">{displayName}</h2>
                {profile?.email && (
                  <p className="tasks-subtitle">{profile.email}</p>
                )}
              </div>
            </div>

            <form className="tasks-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Username</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a display name"
                />
              </label>

              <label className="field">
                <span>Profile picture</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <label className="field">
                <span>Or paste avatar image URL</span>
                <input
                  type="url"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                />
              </label>

              <div className="settings-section">
                <div className="settings-row reset">
                  <div>
                    <strong>Change password</strong>
                    <span>
                      Send a reset link to {profile?.email ?? "your email"} to
                      set a new password.
                    </span>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => void handleRequestPasswordReset()}
                    disabled={passwordResetSending || !profile?.email}
                  >
                    {passwordResetSending ? "Sending…" : "Send reset link"}
                  </button>
                </div>

                <div className="settings-row">
                  <div>
                    <strong>In-app reminders</strong>
                    <span>
                      Browser notifications for upcoming task deadlines.
                      {typeof Notification !== "undefined" &&
                        ` Permission: ${Notification.permission}`}
                    </span>
                  </div>
                  <label
                    className={`toggle ${notificationInApp ? "is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={notificationInApp}
                      onChange={(e) => void handleToggleInApp(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="settings-row">
                  <div>
                    <strong>Email reminders</strong>
                    <span>
                      Get email notifications for upcoming deadlines (requires
                      server setup).
                    </span>
                  </div>
                  <label
                    className={`toggle ${notificationEmail ? "is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={notificationEmail}
                      onChange={(e) => handleToggleEmail(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="settings-row">
                  <div>
                    <strong>Light mode</strong>
                    <span>Switch between dark and light theme.</span>
                  </div>
                  <label
                    className={`toggle ${theme === "light" ? "is-on" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={theme === "light"}
                      onChange={(e) =>
                        handleToggleTheme(e.target.checked ? "light" : "dark")
                      }
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="primary-btn primary-btn--light"
                disabled={saving}
              >
                {saving ? "Saving…" : "Save profile"}
              </button>
            </form>

            {message && <p className="banner banner-success">{message}</p>}
            {passwordResetMessage && (
              <p
                className={`banner ${passwordResetMessage.startsWith("Password reset email sent") ? "banner-success" : "banner-error"}`}
              >
                {passwordResetMessage}
              </p>
            )}
            {error && <p className="banner banner-error">{error}</p>}
          </>
        )}
      </section>
    </div>
  );
}
