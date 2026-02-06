# 🚀 sftp-deploy

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> ***Simple and fast SFTP deployments for any web project.***

A ***lightweight*** *Node.js* script for deploying build outputs to a remote server *via **SFTP***. Perfect for *small projects*, *quick prototypes*, or when you need a simple deploy solution without extra infrastructure.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **Incremental Deploys** | Only uploads changed files using SHA256 hashing |
| 💾 **Local Cache** | Tracks deployed files in `.sftp-deploy-cache.json` |
| 🛡️ **Safe Uploads** | Shows which remote files will be overwritten before uploading |
| 🤖 **Unattended Mode** | Force flag for CI/CD and automated pipelines |
| 📁 **Extra Folders** | Upload additional folders alongside your build |

---

## 📥 Installation

```bash
npm install -D @mjcr/sftp-deploy
```

### Configure credentials

Create `.env` in your project root:

```env
SFTP_HOST=your-server.com
SFTP_PORT=22
SFTP_USER=your-username
SFTP_PASS=your-password
SFTP_PATH=/var/www/html
```

### Add npm script

```json
{
  "scripts": {
    "deploy": "sftp-deploy"
  }
}
```

---

## 🚀 Usage

### Standard deploy (interactive)

```bash
npm run deploy
```
Prompts for confirmation before overwriting remote files.

### Incremental deploy *(recommended)*

```bash
npm run deploy -- --incremental
```
Only uploads files that have changed since last deploy.

### Unattended mode

```bash
npm run deploy -- --unattended
```
Skips all confirmations — perfect for CI/CD pipelines.

### Clean mode

```bash
npm run deploy -- --clean
```
Deletes all files in the remote directory before uploading. Useful when build generates different filenames (like Vite hashed assets).

### Combined

```bash
npm run deploy -- --incremental --unattended
npm run deploy -- --clean --unattended
```

---

## 💡 Example

Full unattended build (Vite) + deploy:

```bash
npm run build && npm run deploy -- --incremental --unattended
```

**Output:**

```
> vite build

✓ 42 modules transformed.
dist/index.html         0.46 kB │ gzip:  0.29 kB
dist/assets/index.css   12.34 kB │ gzip:  2.87 kB
dist/assets/index.js    145.67 kB │ gzip: 46.12 kB
✓ built in 1.23s

> sftp-deploy --incremental --unattended

📦 SFTP Deploy

ℹ Incremental mode: checking for changes...
✓ Skipped 18 unchanged files
ℹ 3 files have changed

ℹ Target: myserver.com:/var/www/html

✓ Connected to server
ℹ Checking existing files...
ℹ Uploading 3 files (--unattended mode)
ℹ Uploading...

  assets/index-Bx7Kz9Lm.js
  assets/index-Qp4Rt2Ws.css
  index.html

✓ Done! 3 files uploaded.
✓ Deploy cache updated
```


---

## 🔧 Configuration

### Credentials (`.env`)

```env
SFTP_HOST=your-server.com
SFTP_PORT=22
SFTP_USER=your-username
SFTP_PASS=your-password
SFTP_PATH=/var/www/html
```

⚠️ **IMPORTANT**: Add these files to your `.gitignore`:
- `.env`
- `.sftp-deploy-cache.json`

### Project Options (`sftp.config.json`)

*Optional.* If not provided, defaults to uploading the `./dist` folder.

Additional options for the deploy process:

```json
{
  "localPath": "./dist",
  "exclude": [],
  "extraFolders": []
}
```

---

## 📁 Advanced Options

### Exclude Files

Skip certain files or patterns from being uploaded:

```json
{
  "exclude": [
    "*.map",
    ".DS_Store",
    "thumbs.db"
  ]
}
```

Patterns support:
- `*.ext` — Match by extension
- `filename` — Match exact filename
- `folder/` — Match folder name anywhere in path

### Extra Folders

Upload additional folders alongside your main build. Useful for backend files (API, PHP, etc.):

**Simple format** — uploads to folder with same name:

```json
{
  "extraFolders": ["./api", "./config"]
}
```

**With custom remote path:**

```json
{
  "extraFolders": [
    { "from": "./api", "to": "/backend/api" },
    { "from": "./php", "to": "/includes" }
  ]
}
```

You can mix both formats in the same array.

---

## 📄 License

*Licensed under the Apache License, Version 2.0.*

---
Made by ⚡[MJCR](https://mjcr.dev)
