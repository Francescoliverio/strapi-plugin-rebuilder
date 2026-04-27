"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ci_1 = require("./ci");
const utils_1 = require("./ci/utils");
const REPO_OWNER = 'Francescoliverio';
const REPO_NAME = 'strapi-plugin-rebuilder';
const REPO_BRANCH = 'main';
const README_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/readme`;
const REPO_RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}/`;
const REPO_BLOB_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${REPO_BRANCH}/`;
const README_CACHE_TTL_MS = 5 * 60 * 1000;
const README_IMAGE_HOSTS = new Set([
    'camo.githubusercontent.com',
    'raw.githubusercontent.com',
    'user-images.githubusercontent.com',
    'avatars.githubusercontent.com',
    'github.com',
]);
const readmeCache = new Map();
const loadMarkdownCss = (variant) => {
    try {
        const filename = variant === 'dark' ? 'github-markdown-dark.css' : 'github-markdown-light.css';
        const cssPath = path_1.default.join(path_1.default.dirname(require.resolve('github-markdown-css/package.json')), filename);
        return fs_1.default.readFileSync(cssPath, 'utf8');
    }
    catch {
        return '';
    }
};
const markdownCssCache = {
    light: '',
    dark: '',
};
const getMarkdownCss = (variant) => {
    if (!markdownCssCache[variant]) {
        markdownCssCache[variant] = loadMarkdownCss(variant);
    }
    return markdownCssCache[variant];
};
const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(value);
const resolveRepoRelative = (raw, base) => {
    const trimmed = raw.replace(/^\.?\//, '').replace(/^\.\.\//g, '');
    return base + trimmed;
};
const stripAttribute = (segment, attr) => segment.replace(new RegExp(`\\s+${attr}="[^"]*"`, 'gi'), '');
const rewriteAnchorHrefs = (html) => html.replace(/<a\b([^>]*?)\s+href="([^"]+)"([^>]*)>/gi, (_, before, href, after) => {
    if (href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('data:') ||
        href.startsWith('javascript:')) {
        return `<a${before} href="${href}"${after}>`;
    }
    const absolute = isAbsoluteHttpUrl(href)
        ? href
        : resolveRepoRelative(href, REPO_BLOB_BASE);
    const cleanedBefore = stripAttribute(stripAttribute(before, 'target'), 'rel');
    const cleanedAfter = stripAttribute(stripAttribute(after, 'target'), 'rel');
    return `<a${cleanedBefore} href="${absolute}"${cleanedAfter} target="_blank" rel="noopener noreferrer">`;
});
const inlineReadmeImages = async (html, log) => {
    const imgRegex = /<img\b([^>]*?)\s+src="([^"]+)"([^>]*)>/gi;
    const matches = Array.from(html.matchAll(imgRegex));
    const replacements = new Map();
    await Promise.all(matches.map(async ([, , originalSrc]) => {
        if (replacements.has(originalSrc))
            return;
        if (originalSrc.startsWith('data:')) {
            replacements.set(originalSrc, originalSrc);
            return;
        }
        const fetchUrl = isAbsoluteHttpUrl(originalSrc)
            ? originalSrc
            : resolveRepoRelative(originalSrc, REPO_RAW_BASE);
        try {
            const parsed = new URL(fetchUrl);
            if (!README_IMAGE_HOSTS.has(parsed.host)) {
                replacements.set(originalSrc, fetchUrl);
                return;
            }
            const response = await axios_1.default.get(fetchUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                maxContentLength: 8 * 1024 * 1024,
                headers: {
                    'User-Agent': `${REPO_NAME}-readme-proxy`,
                },
            });
            const contentType = response.headers['content-type'] || 'image/png';
            const base64 = Buffer.from(response.data).toString('base64');
            replacements.set(originalSrc, `data:${contentType};base64,${base64}`);
        }
        catch (err) {
            log(`[nexjs-rebuilder] Failed to inline README image ${fetchUrl}: ${(err === null || err === void 0 ? void 0 : err.message) || err}`);
            replacements.set(originalSrc, fetchUrl);
        }
    }));
    return html.replace(imgRegex, (_, before, src, after) => {
        var _a;
        const replaced = (_a = replacements.get(src)) !== null && _a !== void 0 ? _a : src;
        return `<img${before} src="${replaced}"${after}>`;
    });
};
const STATUS_STORE_KEY = 'latest-pipeline-status';
const LAST_TRIGGER_STORE_KEY = 'last-trigger-metadata';
const HISTORY_STORE_KEY = 'pipeline-history';
const SETTINGS_STORE_KEY = 'settings';
const DEFAULT_SETTINGS = {
    buildMessageTemplate: 'Release_{HH}_{mm}__{dd}_{MM}_{YYYY}',
    timezone: '',
    historySize: 10,
    pollingIntervalSeconds: 6,
    requireConfirmation: false,
};
const HISTORY_MIN = 5;
const HISTORY_MAX_LIMIT = 50;
const POLLING_MIN = 3;
const POLLING_MAX = 60;
const TEMPLATE_MAX_LENGTH = 200;
const isValidTimezone = (tz) => {
    if (!tz)
        return true;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    }
    catch {
        return false;
    }
};
const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
const normalizeSettings = (raw) => {
    const source = (raw && typeof raw === 'object') ? raw : {};
    return {
        buildMessageTemplate: typeof source.buildMessageTemplate === 'string' && source.buildMessageTemplate.trim()
            ? source.buildMessageTemplate.slice(0, TEMPLATE_MAX_LENGTH)
            : DEFAULT_SETTINGS.buildMessageTemplate,
        timezone: typeof source.timezone === 'string' && isValidTimezone(source.timezone)
            ? source.timezone
            : DEFAULT_SETTINGS.timezone,
        historySize: clamp(Number.isFinite(Number(source.historySize)) ? Math.round(Number(source.historySize)) : DEFAULT_SETTINGS.historySize, HISTORY_MIN, HISTORY_MAX_LIMIT),
        pollingIntervalSeconds: clamp(Number.isFinite(Number(source.pollingIntervalSeconds))
            ? Math.round(Number(source.pollingIntervalSeconds))
            : DEFAULT_SETTINGS.pollingIntervalSeconds, POLLING_MIN, POLLING_MAX),
        requireConfirmation: !!source.requireConfirmation,
    };
};
const getStore = (strapi) => strapi.store({
    type: 'plugin',
    name: 'nexjs-rebuilder',
});
const isSamePipeline = (pipeline, target) => !!pipeline &&
    pipeline.provider === target.provider &&
    pipeline.id != null &&
    target.id != null &&
    String(pipeline.id) === String(target.id);
exports.default = ({ strapi }) => ({
    async getSettings() {
        const store = getStore(strapi);
        const raw = await store.get({ key: SETTINGS_STORE_KEY });
        return normalizeSettings(raw);
    },
    async getReadme(input = {}) {
        var _a;
        const theme = input.theme === 'dark' ? 'dark' : 'light';
        const now = Date.now();
        const cached = readmeCache.get(theme);
        if (cached && cached.expiresAt > now) {
            return { html: cached.html, cached: true };
        }
        try {
            const response = await axios_1.default.get(README_API_URL, {
                headers: {
                    Accept: 'application/vnd.github.html',
                    'User-Agent': `${REPO_NAME}-readme-proxy`,
                },
                responseType: 'text',
                timeout: 15000,
            });
            const log = (msg) => { var _a, _b, _c, _d, _e; return (_c = (_b = (_a = strapi.log) === null || _a === void 0 ? void 0 : _a.warn) === null || _b === void 0 ? void 0 : _b.call(_a, msg)) !== null && _c !== void 0 ? _c : (_e = (_d = strapi.log) === null || _d === void 0 ? void 0 : _d.error) === null || _e === void 0 ? void 0 : _e.call(_d, msg); };
            const inlinedHtml = await inlineReadmeImages(response.data, log);
            const rewrittenHtml = rewriteAnchorHrefs(inlinedHtml);
            const css = getMarkdownCss(theme);
            const overrides = `
.markdown-body{box-sizing:border-box;min-width:200px;max-width:100%;margin:0;padding:0;background:transparent;}
.markdown-body .anchor,.markdown-body .octicon-link{display:none !important;}
.markdown-body h1 .octicon,.markdown-body h2 .octicon,.markdown-body h3 .octicon,.markdown-body h4 .octicon,.markdown-body h5 .octicon,.markdown-body h6 .octicon{display:none !important;}
.markdown-body p>a,.markdown-body p>a>img{display:inline-block;vertical-align:middle;}
.markdown-body p>img{display:inline-block;vertical-align:middle;}
`;
            const html = `<style>${css}${overrides}</style><article class="markdown-body">${rewrittenHtml}</article>`;
            readmeCache.set(theme, { html, expiresAt: now + README_CACHE_TTL_MS });
            return { html, cached: false };
        }
        catch (error) {
            throw (0, utils_1.buildHttpError)(((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status) || 502, `Failed to fetch README from GitHub: ${(error === null || error === void 0 ? void 0 : error.message) || 'unknown error'}`);
        }
    },
    async updateSettings(input) {
        const store = getStore(strapi);
        const current = normalizeSettings(await store.get({ key: SETTINGS_STORE_KEY }));
        const merged = normalizeSettings({ ...current, ...input });
        await store.set({ key: SETTINGS_STORE_KEY, value: merged });
        return merged;
    },
    async getPipelineStatus() {
        const store = getStore(strapi);
        const status = (await store.get({ key: STATUS_STORE_KEY }));
        const lastTrigger = (await store.get({ key: LAST_TRIGGER_STORE_KEY }));
        const history = ((await store.get({ key: HISTORY_STORE_KEY })) || []);
        const configuredProvider = (0, ci_1.getConfiguredProviderName)();
        const base = status ||
            {
                provider: configuredProvider,
                status: 'unknown',
                message: `No pipeline data yet. Waiting for the first ${configuredProvider} webhook event.`,
            };
        return {
            ...base,
            lastTrigger: lastTrigger || null,
            history,
        };
    },
    async savePipelineStatus(incomingPipeline) {
        const store = getStore(strapi);
        const lastTrigger = (await store.get({ key: LAST_TRIGGER_STORE_KEY }));
        const currentStatus = (await store.get({ key: STATUS_STORE_KEY }));
        const history = ((await store.get({ key: HISTORY_STORE_KEY })) || []);
        const existingHistoryItem = history.find((pipeline) => isSamePipeline(pipeline, incomingPipeline)) || null;
        const mergedPipeline = (0, utils_1.mergePipeline)(isSamePipeline(currentStatus, incomingPipeline)
            ? currentStatus
            : existingHistoryItem || undefined, incomingPipeline, lastTrigger);
        await store.set({ key: STATUS_STORE_KEY, value: mergedPipeline });
        const existingIndex = history.findIndex((pipeline) => isSamePipeline(pipeline, incomingPipeline));
        if (existingIndex >= 0) {
            history[existingIndex] = (0, utils_1.mergePipeline)(history[existingIndex], mergedPipeline, lastTrigger);
        }
        else {
            history.unshift(mergedPipeline);
        }
        const settings = normalizeSettings(await store.get({ key: SETTINGS_STORE_KEY }));
        await store.set({ key: HISTORY_STORE_KEY, value: history.slice(0, settings.historySize) });
        return mergedPipeline;
    },
    async triggerPipeline({ message, triggeredBy } = {}) {
        var _a, _b, _c, _d, _e;
        const provider = (0, ci_1.getProvider)((0, ci_1.getConfiguredProviderName)());
        const trimmedMessage = (0, utils_1.trimToNull)(message, 500);
        const trimmedBy = (0, utils_1.trimToNull)(triggeredBy, 200);
        const result = await provider.triggerPipeline({ message: trimmedMessage || undefined, triggeredBy: trimmedBy || undefined });
        const lastTrigger = {
            provider: result.provider,
            message: trimmedMessage,
            triggeredBy: trimmedBy,
            pipelineId: (_a = result.pipelineId) !== null && _a !== void 0 ? _a : null,
            pipelineUrl: (_b = result.pipelineUrl) !== null && _b !== void 0 ? _b : null,
            at: new Date().toISOString(),
        };
        await getStore(strapi).set({
            key: LAST_TRIGGER_STORE_KEY,
            value: lastTrigger,
        });
        return {
            provider: result.provider,
            id: (_c = result.pipelineId) !== null && _c !== void 0 ? _c : null,
            web_url: (_d = result.pipelineUrl) !== null && _d !== void 0 ? _d : null,
            raw: (_e = result.raw) !== null && _e !== void 0 ? _e : null,
        };
    },
    async handleWebhook({ headers, payload, rawBody, }) {
        const providerName = (0, ci_1.detectWebhookProviderName)(headers) || (0, ci_1.getConfiguredProviderName)();
        const provider = (0, ci_1.getProvider)(providerName);
        const lastTrigger = (await getStore(strapi).get({ key: LAST_TRIGGER_STORE_KEY }));
        const result = await provider.handleWebhook({
            headers,
            payload,
            rawBody,
            lastTrigger,
        });
        if ('ignored' in result && result.ignored) {
            return result;
        }
        if (!('pipeline' in result) || !result.pipeline) {
            throw (0, utils_1.buildHttpError)(500, 'Webhook was handled but no normalized pipeline was returned.');
        }
        const saved = await this.savePipelineStatus(result.pipeline);
        return {
            ok: true,
            saved,
            provider: provider.name,
        };
    },
});
