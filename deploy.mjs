#!/usr/bin/env node
/**
 * SFTP Deploy - Lightweight deployment for any web project.
 * 
 * Uploads your build folder to a remote server via SFTP.
 * Credentials via .env file, project options via config.json
 * 
 * @author MJCR <https://mjcr.dev>
 * @license Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { Client } from 'ssh2';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '.deploy-cache.json');

// Load .env file if exists (simple parser, no dependencies)
function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length) {
            process.env[key.trim()] = rest.join('=').trim();
        }
    }
}

loadEnvFile();

// Parse CLI flags
const args = process.argv.slice(2);
const FORCE_MODE = args.includes('--overwrite') || args.includes('-o') ||
    args.includes('--unattended') || args.includes('--auto');
const INCREMENTAL_MODE = args.includes('--incremental') || args.includes('-i');

/**
 * Computes SHA256 hash of a file for change detection.
 * @param {string} filePath - Absolute path to file
 * @returns {string} Hex-encoded hash
 */
function computeFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Loads the deploy cache containing previous file hashes.
 * @returns {Object} Cache object with file paths as keys and hashes as values
 */
function loadDeployCache() {
    if (!fs.existsSync(CACHE_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

/**
 * Saves the deploy cache with updated file hashes.
 * @param {Object} cache - Cache object to persist
 */
function saveDeployCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

/**
 * Filters files to only those that have changed since last deploy.
 * Uses SHA256 hashes stored in .deploy-cache.json for accurate detection.
 * @param {Array} files - Array of file objects with local and relative paths
 * @param {Object} cache - Previous deploy cache
 * @returns {{ changed: Array, unchanged: number, newHashes: Object }}
 */
function filterChangedFiles(files, cache) {
    const changed = [];
    const newHashes = {};
    let unchanged = 0;

    for (const file of files) {
        const hash = computeFileHash(file.local);
        newHashes[file.relative] = hash;

        if (cache[file.relative] !== hash) {
            changed.push(file);
        } else {
            unchanged++;
        }
    }

    return { changed, unchanged, newHashes };
}

// ANSI colors
const c = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

const log = {
    info: (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
    ok: (msg) => console.log(`${c.green}✓${c.reset} ${msg}`),
    warn: (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
    error: (msg) => console.log(`${c.red}✗${c.reset} ${msg}`),
    file: (msg) => console.log(`${c.dim}  ${msg}${c.reset}`)
};

/**
 * Loads config from config.json with environment variable fallbacks.
 */
function loadConfig() {
    const configPath = path.join(__dirname, 'config.json');
    let fileConfig = {};

    if (fs.existsSync(configPath)) {
        try {
            fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch (e) {
            log.error(`Invalid JSON in config.json: ${e.message}`);
            process.exit(1);
        }
    }

    const config = {
        host: process.env.SFTP_HOST || fileConfig.host,
        port: parseInt(process.env.SFTP_PORT) || fileConfig.port || 22,
        username: process.env.SFTP_USER || fileConfig.username,
        password: process.env.SFTP_PASS || fileConfig.password,
        remotePath: process.env.SFTP_PATH || fileConfig.remotePath,
        localPath: fileConfig.localPath || './dist',
        copyBeforeDeploy: fileConfig.copyBeforeDeploy || [],
        exclude: fileConfig.exclude || []
    };

    if (!config.host || !config.username || !config.password || !config.remotePath) {
        log.error('Missing required config: host, username, password, remotePath');
        log.info('Set SFTP_HOST, SFTP_USER, SFTP_PASS, SFTP_PATH env vars');
        log.info('Or create config.json from config.example.json');
        process.exit(1);
    }

    return config;
}

/**
 * Prompts user for y/n confirmation.
 */
function confirm(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(['y', 'yes', 's', 'si'].includes(answer.toLowerCase()));
        });
    });
}

/**
 * Recursively copies a directory.
 */
function copyDir(src, dest) {
    if (!fs.existsSync(src)) {
        log.warn(`Skip copy: ${src} not found`);
        return 0;
    }

    fs.mkdirSync(dest, { recursive: true });
    let count = 0;

    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            count += copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
            count++;
        }
    }

    return count;
}

/**
 * Recursively collects all files from a directory.
 */
function collectFiles(dir, baseDir = dir, exclude = []) {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        const excluded = exclude.some(pattern => {
            if (pattern.startsWith('*.')) return entry.name.endsWith(pattern.slice(1));
            return entry.name === pattern || relativePath.includes(pattern);
        });

        if (excluded) continue;

        if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath, baseDir, exclude));
        } else {
            files.push({
                local: fullPath,
                relative: relativePath.replace(/\\/g, '/')
            });
        }
    }

    return files;
}

/**
 * Creates directories recursively on SFTP server.
 */
function mkdirSftp(sftp, dir) {
    return new Promise(resolve => {
        const parts = dir.split('/').filter(Boolean);
        let current = '';

        const next = (i) => {
            if (i >= parts.length) return resolve();
            current += '/' + parts[i];
            sftp.mkdir(current, () => next(i + 1));
        };

        next(0);
    });
}

/**
 * Checks which files already exist on remote server.
 * Returns array of relative paths that would be overwritten.
 */
function checkExistingFiles(sftp, config, files) {
    return new Promise(resolve => {
        const existing = [];
        let checked = 0;

        if (files.length === 0) return resolve([]);

        for (const file of files) {
            const remotePath = path.posix.join(config.remotePath, file.relative);

            sftp.stat(remotePath, (err, stats) => {
                if (!err && stats) {
                    existing.push(file.relative);
                }
                checked++;

                if (checked === files.length) {
                    resolve(existing);
                }
            });
        }
    });
}

/**
 * Uploads all files to remote server via SFTP.
 */
async function upload(config, files) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let uploaded = 0, failed = 0;

        conn.on('ready', () => {
            log.ok('Connected to server');

            conn.sftp(async (err, sftp) => {
                if (err) return reject(err);

                // Check for existing files first
                log.info('Checking existing files...');
                const existing = await checkExistingFiles(sftp, config, files);

                if (existing.length > 0 && !FORCE_MODE) {
                    console.log();
                    log.warn(`${existing.length} files will be overwritten:\n`);

                    // Show files (max 20, then summary)
                    const showMax = 20;
                    for (let i = 0; i < Math.min(existing.length, showMax); i++) {
                        console.log(`  ${c.yellow}→${c.reset} ${existing[i]}`);
                    }
                    if (existing.length > showMax) {
                        console.log(`  ${c.dim}... and ${existing.length - showMax} more${c.reset}`);
                    }
                    console.log();

                    const overwrite = await confirm('Overwrite these files? (y/n): ');
                    if (!overwrite) {
                        conn.end();
                        log.warn('Cancelled');
                        process.exit(0);
                    }
                    console.log();
                } else if (existing.length > 0 && FORCE_MODE) {
                    log.info(`Overwriting ${existing.length} existing files (--overwrite mode)`);
                }

                log.info('Uploading...\n');

                const uploadFile = async (i) => {
                    if (i >= files.length) {
                        conn.end();
                        return resolve({ uploaded, failed });
                    }

                    const file = files[i];
                    const remotePath = path.posix.join(config.remotePath, file.relative);

                    await mkdirSftp(sftp, path.posix.dirname(remotePath));

                    sftp.fastPut(file.local, remotePath, err => {
                        if (err) {
                            log.error(`Failed: ${file.relative}`);
                            failed++;
                        } else {
                            log.file(file.relative);
                            uploaded++;
                        }
                        uploadFile(i + 1);
                    });
                };

                uploadFile(0);
            });
        });

        conn.on('error', reject);

        conn.connect({
            host: config.host,
            port: config.port || 22,
            username: config.username,
            password: config.password
        });
    });
}

/**
 * Main entry point.
 */
async function main() {
    console.log('\n📦 SFTP Deploy\n');

    const config = loadConfig();
    const localPath = path.resolve(config.localPath || './dist');

    if (!fs.existsSync(localPath)) {
        log.error(`Build folder not found: ${localPath}`);
        log.info('Run your build command first (e.g., npm run build)');
        process.exit(1);
    }

    // Pre-deploy copy
    if (Array.isArray(config.copyBeforeDeploy) && config.copyBeforeDeploy.length > 0) {
        log.info('Running pre-deploy copy...');
        for (const { from, to } of config.copyBeforeDeploy) {
            const count = copyDir(path.resolve(from), path.resolve(to));
            log.ok(`Copied ${count} files: ${from} → ${to}`);
        }
        console.log();
    }

    // Collect all files from source directory
    let files = collectFiles(localPath, localPath, config.exclude || []);
    let newHashes = null;

    // Incremental mode: filter to only changed files
    if (INCREMENTAL_MODE) {
        log.info('Incremental mode: checking for changes...');
        const cache = loadDeployCache();
        const result = filterChangedFiles(files, cache);

        files = result.changed;
        newHashes = result.newHashes;

        if (result.unchanged > 0) {
            log.ok(`Skipped ${result.unchanged} unchanged files`);
        }

        if (files.length === 0) {
            log.ok('No changes detected. Nothing to upload.');
            process.exit(0);
        }

        log.info(`${files.length} files have changed\n`);
    } else {
        log.info(`Found ${files.length} files to upload`);
    }

    log.info(`Target: ${config.host}:${config.remotePath}\n`);

    // Initial confirmation (skip in overwrite/force mode)
    if (!FORCE_MODE && !await confirm('Connect and check server? (y/n): ')) {
        log.warn('Cancelled');
        process.exit(0);
    }

    console.log();

    try {
        const result = await upload(config, files);
        console.log();
        log.ok(`Done! ${result.uploaded} files uploaded.`);
        if (result.failed > 0) log.warn(`${result.failed} files failed.`);

        // Update cache only after successful upload in incremental mode
        if (INCREMENTAL_MODE && newHashes && result.failed === 0) {
            saveDeployCache(newHashes);
            log.ok('Deploy cache updated');
        }
    } catch (err) {
        log.error(`Deploy failed: ${err.message}`);
        process.exit(1);
    }
}

main();
