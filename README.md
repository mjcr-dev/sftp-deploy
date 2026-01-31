# 🚀 sftp-deploy

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org) [![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

> ***Simple, fast, and reliable SFTP deployments for any web project.***

A ***lightweight*** *Node.js* script for deploying build outputs to a remote server *via **SFTP***. Perfect for *small projects*, *quick prototypes*, or when you need a simple deploy solution without extra infrastructure.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 **Incremental Deploys** | Only uploads changed files using SHA256 hashing |
| 💾 **Local Cache** | Tracks deployed files in `.sftp-deploy-cache.json` |
| 🛡️ **Safe Uploads** | Shows which remote files will be overwritten before uploading |
| 🤖 **Unattended Mode** | Force flag for CI/CD and automated pipelines |
| 📁 **Extra Folders** | Copy additional directories into build before deploy |

---

## 📥 Installation

### Option A: npm install *(recommended)*

```bash
npm install @mjcr/sftp-deploy
```

Then create `.env` in your project root with your credentials.  
*Optionally, create `sftp.config.json` for additional options (localPath, exclude, etc.).*

### Option B: Copy the deploy folder

```bash
cp -r deploy/ your-project/
```

### Install peer dependency

```bash
npm install ssh2
```

### Configure credentials

```bash
cp .env.example .env
```

Edit `.env` with your server details:

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

Or if using manual copy:

```json
{
  "scripts": {
    "deploy": "node deploy/deploy.mjs"
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

### Force mode (unattended)

```bash
npm run deploy -- --overwrite
```
Skips all confirmations — perfect for CI/CD pipelines.

### Combined

```bash
npm run deploy -- --incremental --overwrite
```

---

## 💡 Example

Full unattended build (Vite) + deploy:

```bash
npm run build && npm run deploy -- --incremental --overwrite
```

**Output:**

```
> vite build

✓ 42 modules transformed.
dist/index.html         0.46 kB │ gzip:  0.29 kB
dist/assets/index.css   12.34 kB │ gzip:  2.87 kB
dist/assets/index.js    145.67 kB │ gzip: 46.12 kB
✓ built in 1.23s

> node deploy/deploy.mjs --incremental --overwrite

📦 SFTP Deploy

ℹ Incremental mode: checking for changes...
✓ Skipped 18 unchanged files
ℹ 3 files have changed

ℹ Target: myserver.com:/var/www/html

✓ Connected to server
ℹ Checking existing files...
ℹ Overwriting 3 existing files (--overwrite mode)
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
  "copyBeforeDeploy": []
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

### Copy Before Deploy

Copy additional folders into your build directory before uploading. Useful for adding backend files (like `api/` or `php/`) to a frontend build:

```json
{
  "copyBeforeDeploy": [
    { "from": "./api", "to": "./dist/api" },
    { "from": "./public/assets", "to": "./dist/assets" }
  ]
}
```

This runs automatically before the upload starts.

---

## 📋 Requirements

- **Node.js** 18+
- **ssh2** npm package

---

## 📄 License

*Licensed under the Apache License, Version 2.0.*

---
Made by ⚡[MJCR](https://mjcr.dev)
