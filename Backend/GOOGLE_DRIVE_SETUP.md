# Google Drive File Upload Setup

## 1) Install dependency

Run this in `Backend`:

```bash
npm install
```

(`multer` was added to `package.json` for multipart uploads.)

## 2) Choose auth mode

You can use either **Service Account** (recommended for server-to-server uploads) or **OAuth2 refresh token**.

### Option A: Service Account (recommended)

Set one of these env styles:

- `GOOGLE_SERVICE_ACCOUNT_JSON` as full JSON string (single-line)
- OR:
  - `GOOGLE_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (use `\n` for line breaks)

### Option B: OAuth2 refresh token

Set:

- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REFRESH_TOKEN`
- Optional: `GOOGLE_DRIVE_REDIRECT_URI`

## 3) Optional upload settings

- `GOOGLE_DRIVE_FOLDER_ID` (upload into a specific Drive folder)
- `MAX_UPLOAD_SIZE_BYTES` (defaults to `10485760`, i.e. 10 MB)

## 4) Endpoint

Authenticated users with task access can upload to:

- `POST /api/tasks/:taskId/attachments`
- Content type: `multipart/form-data`
- File field name: `file`

Response includes:

- attachment metadata (`name`, `size`, `type`)
- public `url` (download)
- `view_url`
- `drive_file_id`

Attachment metadata is automatically appended to `tasks/{taskId}.attachments` in Firestore.
