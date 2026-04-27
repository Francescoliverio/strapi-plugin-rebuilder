import axios from 'axios';
import path from 'path';
import fs from 'fs';

import { detectWebhookProviderName, getConfiguredProviderName, getProvider } from './ci';
import { LastTriggerMetadata, NormalizedPipeline, PluginSettings, TriggerPipelineInput } from './ci/types';
import { buildHttpError, mergePipeline, trimToNull } from './ci/utils';
import type { StrapiLike, StrapiLifecycleContext } from '../types/strapi';

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

const readmeCache = new Map<'light' | 'dark', { html: string; expiresAt: number }>();

const loadMarkdownCss = (variant: 'light' | 'dark'): string => {
  try {
    const filename = variant === 'dark' ? 'github-markdown-dark.css' : 'github-markdown-light.css';
    const cssPath = path.join(
      path.dirname(require.resolve('github-markdown-css/package.json')),
      filename
    );
    return fs.readFileSync(cssPath, 'utf8');
  } catch {
    return '';
  }
};

const markdownCssCache: Record<'light' | 'dark', string> = {
  light: '',
  dark: '',
};

const getMarkdownCss = (variant: 'light' | 'dark'): string => {
  if (!markdownCssCache[variant]) {
    markdownCssCache[variant] = loadMarkdownCss(variant);
  }
  return markdownCssCache[variant];
};

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const resolveRepoRelative = (raw: string, base: string): string => {
  const trimmed = raw.replace(/^\.?\//, '').replace(/^\.\.\//g, '');
  return base + trimmed;
};

const stripAttribute = (segment: string, attr: string) =>
  segment.replace(new RegExp(`\\s+${attr}="[^"]*"`, 'gi'), '');

const rewriteAnchorHrefs = (html: string): string =>
  html.replace(/<a\b([^>]*?)\s+href="([^"]+)"([^>]*)>/gi, (_, before, href, after) => {
    if (
      href.startsWith('#') ||
      href.startsWith('mailto:') ||
      href.startsWith('data:') ||
      href.startsWith('javascript:')
    ) {
      return `<a${before} href="${href}"${after}>`;
    }
    const absolute = isAbsoluteHttpUrl(href)
      ? href
      : resolveRepoRelative(href, REPO_BLOB_BASE);
    const cleanedBefore = stripAttribute(stripAttribute(before, 'target'), 'rel');
    const cleanedAfter = stripAttribute(stripAttribute(after, 'target'), 'rel');
    return `<a${cleanedBefore} href="${absolute}"${cleanedAfter} target="_blank" rel="noopener noreferrer">`;
  });

const inlineReadmeImages = async (
  html: string,
  log: (msg: string) => void
): Promise<string> => {
  const imgRegex = /<img\b([^>]*?)\s+src="([^"]+)"([^>]*)>/gi;
  const matches = Array.from(html.matchAll(imgRegex));
  const replacements = new Map<string, string>();

  await Promise.all(
    matches.map(async ([, , originalSrc]) => {
      if (replacements.has(originalSrc)) return;
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
        const response = await axios.get<ArrayBuffer>(fetchUrl, {
          responseType: 'arraybuffer',
          timeout: 15_000,
          maxContentLength: 8 * 1024 * 1024,
          headers: {
            'User-Agent': `${REPO_NAME}-readme-proxy`,
          },
        });
        const contentType =
          (response.headers['content-type'] as string | undefined) || 'image/png';
        const base64 = Buffer.from(response.data).toString('base64');
        replacements.set(originalSrc, `data:${contentType};base64,${base64}`);
      } catch (err: any) {
        log(
          `[nexjs-rebuilder] Failed to inline README image ${fetchUrl}: ${err?.message || err}`
        );
        replacements.set(originalSrc, fetchUrl);
      }
    })
  );

  return html.replace(imgRegex, (_, before, src, after) => {
    const replaced = replacements.get(src) ?? src;
    return `<img${before} src="${replaced}"${after}>`;
  });
};

const STATUS_STORE_KEY = 'latest-pipeline-status';
const LAST_TRIGGER_STORE_KEY = 'last-trigger-metadata';
const HISTORY_STORE_KEY = 'pipeline-history';
const SETTINGS_STORE_KEY = 'settings';

const DEFAULT_SETTINGS: PluginSettings = {
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

const isValidTimezone = (tz: string): boolean => {
  if (!tz) return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

const normalizeSettings = (raw: any): PluginSettings => {
  const source = (raw && typeof raw === 'object') ? raw : {};
  return {
    buildMessageTemplate:
      typeof source.buildMessageTemplate === 'string' && source.buildMessageTemplate.trim()
        ? source.buildMessageTemplate.slice(0, TEMPLATE_MAX_LENGTH)
        : DEFAULT_SETTINGS.buildMessageTemplate,
    timezone:
      typeof source.timezone === 'string' && isValidTimezone(source.timezone)
        ? source.timezone
        : DEFAULT_SETTINGS.timezone,
    historySize: clamp(
      Number.isFinite(Number(source.historySize)) ? Math.round(Number(source.historySize)) : DEFAULT_SETTINGS.historySize,
      HISTORY_MIN,
      HISTORY_MAX_LIMIT
    ),
    pollingIntervalSeconds: clamp(
      Number.isFinite(Number(source.pollingIntervalSeconds))
        ? Math.round(Number(source.pollingIntervalSeconds))
        : DEFAULT_SETTINGS.pollingIntervalSeconds,
      POLLING_MIN,
      POLLING_MAX
    ),
    requireConfirmation: !!source.requireConfirmation,
  };
};

const getStore = (strapi: StrapiLike) =>
  strapi.store({
    type: 'plugin',
    name: 'nexjs-rebuilder',
  });

const isSamePipeline = (
  pipeline: Partial<NormalizedPipeline> | null | undefined,
  target: Partial<NormalizedPipeline>
) =>
  !!pipeline &&
  pipeline.provider === target.provider &&
  pipeline.id != null &&
  target.id != null &&
  String(pipeline.id) === String(target.id);

export default ({ strapi }: StrapiLifecycleContext) => ({
  async getSettings(): Promise<PluginSettings> {
    const store = getStore(strapi);
    const raw = await store.get({ key: SETTINGS_STORE_KEY });
    return normalizeSettings(raw);
  },

  async getReadme(
    input: { theme?: 'light' | 'dark' } = {}
  ): Promise<{ html: string; cached: boolean }> {
    const theme: 'light' | 'dark' = input.theme === 'dark' ? 'dark' : 'light';
    const now = Date.now();
    const cached = readmeCache.get(theme);
    if (cached && cached.expiresAt > now) {
      return { html: cached.html, cached: true };
    }
    try {
      const response = await axios.get<string>(README_API_URL, {
        headers: {
          Accept: 'application/vnd.github.html',
          'User-Agent': `${REPO_NAME}-readme-proxy`,
        },
        responseType: 'text',
        timeout: 15_000,
      });
      const log = (msg: string) => (strapi.log as any)?.warn?.(msg) ?? strapi.log?.error?.(msg);
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
    } catch (error: any) {
      throw buildHttpError(
        error?.response?.status || 502,
        `Failed to fetch README from GitHub: ${error?.message || 'unknown error'}`
      );
    }
  },

  async updateSettings(input: Partial<PluginSettings>): Promise<PluginSettings> {
    const store = getStore(strapi);
    const current = normalizeSettings(await store.get({ key: SETTINGS_STORE_KEY }));
    const merged = normalizeSettings({ ...current, ...input });
    await store.set({ key: SETTINGS_STORE_KEY, value: merged });
    return merged;
  },

  async getPipelineStatus() {
    const store = getStore(strapi);
    const status = (await store.get({ key: STATUS_STORE_KEY })) as NormalizedPipeline | undefined;
    const lastTrigger = (await store.get({ key: LAST_TRIGGER_STORE_KEY })) as
      | LastTriggerMetadata
      | undefined;
    const history = ((await store.get({ key: HISTORY_STORE_KEY })) || []) as NormalizedPipeline[];
    const configuredProvider = getConfiguredProviderName();

    const base =
      status ||
      ({
        provider: configuredProvider,
        status: 'unknown',
        message: `No pipeline data yet. Waiting for the first ${configuredProvider} webhook event.`,
      } as const);

    return {
      ...base,
      lastTrigger: lastTrigger || null,
      history,
    };
  },

  async savePipelineStatus(incomingPipeline: NormalizedPipeline) {
    const store = getStore(strapi);
    const lastTrigger = (await store.get({ key: LAST_TRIGGER_STORE_KEY })) as
      | LastTriggerMetadata
      | undefined;
    const currentStatus = (await store.get({ key: STATUS_STORE_KEY })) as
      | NormalizedPipeline
      | undefined;
    const history = ((await store.get({ key: HISTORY_STORE_KEY })) || []) as NormalizedPipeline[];
    const existingHistoryItem =
      history.find((pipeline) => isSamePipeline(pipeline, incomingPipeline)) || null;

    const mergedPipeline = mergePipeline(
      isSamePipeline(currentStatus, incomingPipeline)
        ? currentStatus
        : existingHistoryItem || undefined,
      incomingPipeline,
      lastTrigger
    );

    await store.set({ key: STATUS_STORE_KEY, value: mergedPipeline });

    const existingIndex = history.findIndex((pipeline) => isSamePipeline(pipeline, incomingPipeline));
    if (existingIndex >= 0) {
      history[existingIndex] = mergePipeline(history[existingIndex], mergedPipeline, lastTrigger);
    } else {
      history.unshift(mergedPipeline);
    }

    const settings = normalizeSettings(await store.get({ key: SETTINGS_STORE_KEY }));
    await store.set({ key: HISTORY_STORE_KEY, value: history.slice(0, settings.historySize) });

    return mergedPipeline;
  },

  async triggerPipeline({ message, triggeredBy }: TriggerPipelineInput = {}) {
    const provider = getProvider(getConfiguredProviderName());
    const trimmedMessage = trimToNull(message, 500);
    const trimmedBy = trimToNull(triggeredBy, 200);
    const result = await provider.triggerPipeline({ message: trimmedMessage || undefined, triggeredBy: trimmedBy || undefined });

    const lastTrigger: LastTriggerMetadata = {
      provider: result.provider,
      message: trimmedMessage,
      triggeredBy: trimmedBy,
      pipelineId: result.pipelineId ?? null,
      pipelineUrl: result.pipelineUrl ?? null,
      at: new Date().toISOString(),
    };

    await getStore(strapi).set({
      key: LAST_TRIGGER_STORE_KEY,
      value: lastTrigger,
    });

    return {
      provider: result.provider,
      id: result.pipelineId ?? null,
      web_url: result.pipelineUrl ?? null,
      raw: result.raw ?? null,
    };
  },

  async handleWebhook({
    headers,
    payload,
    rawBody,
  }: {
    headers: Record<string, any>;
    payload: any;
    rawBody?: string | Buffer | null;
  }) {
    const providerName = detectWebhookProviderName(headers) || getConfiguredProviderName();
    const provider = getProvider(providerName);
    const lastTrigger = (await getStore(strapi).get({ key: LAST_TRIGGER_STORE_KEY })) as
      | LastTriggerMetadata
      | undefined;
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
      throw buildHttpError(500, 'Webhook was handled but no normalized pipeline was returned.');
    }

    const saved = await this.savePipelineStatus(result.pipeline);

    return {
      ok: true,
      saved,
      provider: provider.name,
    };
  },
});
