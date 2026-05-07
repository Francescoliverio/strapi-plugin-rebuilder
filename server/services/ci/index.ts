import { githubProvider } from './providers/github';
import { gitlabProvider } from './providers/gitlab';
import { CiProvider, CiProviderName } from './types';
import { buildHttpError, getHeader, trimToNull } from './utils';

const providers: Record<CiProviderName, CiProvider> = {
  gitlab: gitlabProvider,
  github: githubProvider,
};

export const getConfiguredProviderName = (): CiProviderName => {
  const configured = trimToNull(process.env.NEXJS_REBUILDER_PROVIDER)?.toLowerCase();

  if (configured === 'github') return 'github';
  if (configured === 'gitlab') return 'gitlab';

  if (trimToNull(process.env.NEXJS_REBUILDER_GITHUB_TOKEN) || trimToNull(process.env.NEXJS_REBUILDER_GITHUB_OWNER)) return 'github';
  if (trimToNull(process.env.NEXJS_REBUILDER_GITLAB_TRIGGER_TOKEN) || trimToNull(process.env.NEXJS_REBUILDER_GITLAB_PROJECT_ID) || trimToNull(process.env.STRAPI_ADMIN_GITLAB_PROJECT_ID)) return 'gitlab';

  throw buildHttpError(
    500,
    'No CI provider configured. Set NEXJS_REBUILDER_PROVIDER to "gitlab" or "github" and provide the required environment variables. See the plugin documentation for details.',
  );
};

export const detectWebhookProviderName = (
  headers: Record<string, any>
): CiProviderName | null => {
  if (getHeader(headers, 'x-github-event')) return 'github';
  if (getHeader(headers, 'x-gitlab-event')) return 'gitlab';

  return null;
};

export const getProvider = (providerName: CiProviderName): CiProvider => providers[providerName];
