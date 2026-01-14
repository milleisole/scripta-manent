# miserve — Technical Documentation

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES6+ modules)
- **UI**: HTML5, CSS3 (mobile-first, responsive)
- **App type**: Progressive Web App (PWA)
- **Storage**: Google Drive API (more providers planned)
- **Encryption**: Web Crypto API (AES-256-GCM)
- **Sharing**: Web Share API + QR Code generation

No frameworks, no build tools, no dependencies hell. Just clean, modern JavaScript.

---

## Project Structure

```
miserve/
├── index.html
├── manifest.json
├── sw.js                    # Service Worker (offline support)
├── css/
│   └── style.css
├── js/
│   ├── app.js               # Entry point
│   ├── config.js            # Google API configuration
│   ├── storage/
│   │   ├── storage-interface.js   # Abstract interface
│   │   └── google-drive.js        # Google Drive implementation
│   ├── crypto/
│   │   ├── encryption.js    # AES-256-GCM encryption
│   │   └── key-manager.js   # DEK/KEK management
│   ├── models/
│   │   ├── note.js
│   │   ├── file-item.js
│   │   └── folder.js
│   ├── services/
│   │   ├── notes-service.js
│   │   ├── files-service.js
│   │   ├── search-service.js
│   │   ├── trash-service.js
│   │   └── share-service.js
│   ├── ui/
│   │   ├── components/
│   │   ├── views/
│   │   └── router.js
│   └── utils/
│       ├── hash.js          # SHA-256 hashing
│       ├── qrcode.js        # QR code generation
│       └── markdown.js      # Markdown parser
└── assets/
    └── icons/
```

---

## Data Structure on Google Drive

When you connect miserve to your Google Drive, it creates this folder structure:

```
miserve/
├── miserve.json             # Global index + settings
├── vault.enc                # Encrypted master key (DEK)
├── search-index.json        # Full-text search index
├── notes/
│   └── {uuid}/
│       ├── content.md       # Note content (or .enc if encrypted)
│       └── meta.json        # Metadata
├── files/
│   └── {uuid}/
│       ├── {filename}       # Original file (or .enc if encrypted)
│       └── meta.json
├── media/
│   └── {uuid}/
│       ├── {filename}
│       └── meta.json
└── .trash/
    └── {uuid}/
        └── {timestamp}_{filename}   # Versioned backups
```

---

## JSON Schemas

### miserve.json (Global Index)

```json
{
  "version": "1.0.0",
  "created": "2025-01-14T10:30:00Z",
  "lastSync": "2025-01-14T15:45:00Z",
  "settings": {
    "theme": "auto",
    "language": "it",
    "trashRetentionDays": 15,
    "maxVersionsSmallFile": 2,
    "maxVersionsLargeFile": 1,
    "largeFileSizeThreshold": 5242880
  },
  "folders": [
    {"path": "/notes", "name": "Notes"},
    {"path": "/files", "name": "Files"},
    {"path": "/media", "name": "Media"}
  ],
  "stats": {
    "totalNotes": 0,
    "totalFiles": 0,
    "totalSize": 0
  }
}
```

### meta.json (Item Metadata)

```json
{
  "id": "uuid-v4",
  "name": "Display name",
  "type": "note|file|media",
  "mimeType": "text/markdown",
  "created": "2025-01-14T10:30:00Z",
  "updated": "2025-01-14T15:45:00Z",
  "hash": "sha256:abc123...",
  "size": 1024,
  "encrypted": false,
  "folder": "/path/to/folder",
  "tags": ["tag1", "tag2"],
  "versions": 1
}
```

### search-index.json (Full-Text Index)

```json
{
  "version": 1,
  "lastUpdate": "2025-01-14T15:45:00Z",
  "entries": [
    {
      "id": "uuid",
      "type": "note",
      "name": "Note title",
      "folder": "/notes",
      "tags": ["tag1"],
      "content": "first ~500 words of content...",
      "encrypted": false
    }
  ]
}
```

---

## Encryption System

miserve uses a two-key architecture for secure, recoverable encryption.

### Keys

- **DEK (Data Encryption Key)**: Random AES-256 key that encrypts your files. Generated once, never changes.
- **KEK (Key Encryption Key)**: Derived from your master password using PBKDF2 (100,000 iterations, SHA-256). Used to encrypt the DEK.

### vault.enc Schema

```json
{
  "version": 1,
  "salt": "base64...",
  "iv": "base64...",
  "encryptedDEK": "base64...",
  "recoveryHash": "sha256(googleUserId + salt)",
  "createdAt": "2025-01-14T10:30:00Z"
}
```

### Encryption Flow

1. User sets master password
2. Generate random DEK (256 bits)
3. Derive KEK from password with PBKDF2
4. Encrypt DEK with KEK (AES-256-GCM)
5. Save vault.enc to Drive
6. To encrypt a file: use DEK directly (AES-256-GCM)

### Password Recovery Flow

If you forget your password:

1. Click "Forgot password"
2. Authenticate with Google
3. System verifies `sha256(googleUserId + salt) == recoveryHash`
4. If match, set new password
5. New KEK encrypts the same DEK
6. All encrypted files remain readable (DEK unchanged)

**Important**: This only works if you're the legitimate Google account owner. Without Google authentication, encrypted files cannot be recovered.

---

## Trash & Versioning

### Rules

| File Size | Max Versions in Trash |
|-----------|----------------------|
| < 5 MB    | 2                    |
| ≥ 5 MB    | 1                    |

- Retention period: **15 days**
- When saving a new version: previous version moves to `.trash/`
- Encrypted files: the encrypted version is moved to trash

### Naming Convention

```
.trash/{uuid}/{ISO-timestamp}_{original-filename}
```

Example: `.trash/abc123/2025-01-14T10-30-00_document.md`

### Auto-Cleanup

On app load:
1. Scan all files in `.trash/`
2. Delete files older than 15 days
3. For each uuid, keep only the N most recent versions (based on file size)

---

## Full-Text Search

### How It Works

- The search index (`search-index.json`) is updated incrementally when you create/edit/delete notes
- Index contains: name, tags, folder, and first ~500 words of content
- Encrypted files: only name, tags, and folder are indexed (not content)
- Search is case-insensitive, supports multiple terms (implicit AND)

### Performance

The index lives on Drive and is loaded once per session. Searches are instant because they query the local index, not the Drive API.

---

## Sharing

### QR Code

1. User clicks "Share" on a file
2. App uses Google Drive API to create a shared link
3. QR code is generated client-side
4. Recipient scans and downloads

### Web Share API

```javascript
navigator.share({
  files: [file],
  title: 'Document from miserve',
  text: 'Here is the file'
})
```

Opens native share sheet on mobile — user chooses their preferred app (email, WhatsApp, Telegram, etc.).

**Browser Support**:
- Android Chrome: ✅
- iOS Safari: ✅
- Desktop: Partial

---

## Google Drive API

### Required Scopes

```
https://www.googleapis.com/auth/drive.file
```

This scope allows access **only** to files created by miserve, not the user's entire Drive. More privacy, fewer permissions.

### API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `files.list` | List files |
| `files.get` | Get metadata |
| `files.get?alt=media` | Download content |
| `files.create` | Create file |
| `files.update` | Update file |
| `files.delete` | Delete file |
| `permissions.create` | Create share permission |

### Authentication

- OAuth 2.0 with PKCE (client-side flow)
- Access token stored in memory
- Refresh token in localStorage
- Auto-refresh before expiration

---

## Storage Providers (Roadmap)

| Provider | Status |
|----------|--------|
| Google Drive | ✅ Implemented |
| OneDrive | 🔜 Planned |
| Dropbox | 🔜 Planned |
| WebDAV (Nextcloud, ownCloud) | 🔜 Planned |
| S3-compatible | 🔜 Planned |

The `storage-interface.js` defines a common interface. Each provider implements this interface, making it easy to add new ones.

---

## Setup Instructions

### Prerequisites

- A Google account
- A web server to host the static files (any server works: Apache, Nginx, Caddy, or even GitHub Pages)

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/miserve.git
cd miserve
```

### 2. Configure Google Cloud Console

Follow the detailed guide: [Google Cloud Setup Guide](docs/google-cloud-setup.md)

Quick summary:
1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google Drive API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials (Web application)
5. Add your domain to authorized origins and redirect URIs

### 3. Update Configuration

Edit `js/config.js`:

```javascript
export const CONFIG = {
  GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
  GOOGLE_SCOPES: 'https://www.googleapis.com/auth/drive.file',
  ROOT_FOLDER_NAME: 'miserve'
};
```

### 4. Deploy

Upload all files to your web server. That's it.

For local development:
```bash
# Python 3
python -m http.server 8080

# Node.js
npx serve .
```

---

## Development

### Code Style

- ES6+ modules
- Async/await everywhere
- Comments in Italian (project origin)
- Mobile-first CSS

### Adding a Storage Provider

1. Create `js/storage/your-provider.js`
2. Implement the interface from `storage-interface.js`
3. Register in the provider selector

### Building for Production

No build step required. The app runs directly from source.

For optimization, you can optionally:
- Minify JS/CSS
- Generate icon sizes for PWA
- Configure caching headers on your server

---

## Security Considerations

- **No backend = no attack surface** on our side
- **Encryption keys never transmitted** — derived in browser via Web Crypto API
- **OAuth tokens in memory** — not persisted in plain text
- **drive.file scope** — app can only access its own folder, not your entire Drive
- **All crypto is native** — Web Crypto API, no external libraries

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

MIT — do whatever you want with it.

---

## Questions?

Open an issue on GitHub.
