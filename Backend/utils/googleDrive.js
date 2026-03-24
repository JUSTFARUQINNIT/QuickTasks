import { google } from "googleapis";
import { Readable } from "stream";

const DRIVE_SCOPE = ["https://www.googleapis.com/auth/drive"];

function getServiceAccountConfig() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return {
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    } catch (error) {
      throw new Error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON format");
    }
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

  if (!clientEmail || !privateKey) {
    return null;
  }

  return { clientEmail, privateKey };
}

function getOAuthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_DRIVE_REDIRECT_URI;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri || "urn:ietf:wg:oauth:2.0:oob",
    refreshToken,
  };
}

function createAuthClient() {
  const authMode = (process.env.GOOGLE_DRIVE_AUTH_MODE || "auto").toLowerCase();
  const serviceAccount = getServiceAccountConfig();
  const oauthConfig = getOAuthConfig();

  if (authMode === "oauth") {
    if (!oauthConfig) {
      throw new Error(
        "GOOGLE_DRIVE_AUTH_MODE=oauth but OAuth env vars are missing",
      );
    }
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri,
    );
    oauth2Client.setCredentials({ refresh_token: oauthConfig.refreshToken });
    return oauth2Client;
  }

  if (authMode === "service_account") {
    if (!serviceAccount) {
      throw new Error(
        "GOOGLE_DRIVE_AUTH_MODE=service_account but service account env vars are missing",
      );
    }
    return new google.auth.JWT(
      serviceAccount.clientEmail,
      null,
      serviceAccount.privateKey,
      DRIVE_SCOPE,
    );
  }

  // Auto mode:
  // - Prefer OAuth (personal Drive quota)
  // - Fallback to service account when OAuth is unavailable
  if (oauthConfig) {
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.clientId,
      oauthConfig.clientSecret,
      oauthConfig.redirectUri,
    );
    oauth2Client.setCredentials({ refresh_token: oauthConfig.refreshToken });
    return oauth2Client;
  }

  if (serviceAccount) {
    return new google.auth.JWT(
      serviceAccount.clientEmail,
      null,
      serviceAccount.privateKey,
      DRIVE_SCOPE,
    );
  }

  throw new Error(
    "Google Drive auth is not configured. Set service-account or OAuth env vars.",
  );
}

export async function uploadBufferToGoogleDrive({
  buffer,
  fileName,
  mimeType,
  folderId,
}) {
  try {
    const auth = createAuthClient();
    const drive = google.drive({ version: "v3", auth });

    const createResponse = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      },
      media: {
        mimeType: mimeType || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id,name,size,mimeType",
      supportsAllDrives: true,
    });

    const fileId = createResponse.data.id;
    if (!fileId) {
      throw new Error("Google Drive upload failed: missing file id");
    }

    await drive.permissions.create({
      fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    const fileMeta = await drive.files.get({
      fileId,
      fields: "id,name,size,mimeType,webViewLink,webContentLink",
      supportsAllDrives: true,
    });

    return {
      driveFileId: fileMeta.data.id,
      name: fileMeta.data.name || fileName,
      size: Number(fileMeta.data.size || 0),
      mimeType: fileMeta.data.mimeType || mimeType || "application/octet-stream",
      viewUrl: fileMeta.data.webViewLink || null,
      downloadUrl:
        fileMeta.data.webContentLink ||
        (fileMeta.data.id
          ? `https://drive.google.com/uc?id=${fileMeta.data.id}&export=download`
          : null),
    };
  } catch (error) {
    const message = String(error?.message || "");
    if (message.includes("Service Accounts do not have storage quota")) {
      throw new Error(
        "Service account quota error. Use OAuth mode (GOOGLE_DRIVE_AUTH_MODE=oauth) for personal Drive, or upload into a Shared Drive folder and keep service_account mode.",
      );
    }
    throw error;
  }
}
