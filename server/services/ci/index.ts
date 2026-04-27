import { githubProvider } from './providers/github';
import { gitlabProvider } from './providers/gitlab';
import { CiProvider, CiProviderName } from './types';
import { getHeader, trimToNull } from './utils';

const providers: Record<CiProviderName, CiProvider> = {
  gitlab: gitlabProvider,
  github: githubProvider,
};

export const getConfiguredProviderName = (): CiProviderName => {
  const configured = trimToNull(process.env.NEXJS_REBUILDER_PROVIDER)?.toLowerCase();

  if (configured === 'github') return 'github';

  return 'gitlab';
};

export const detectWebhookProviderName = (
  headers: Record<string, any>
): CiProviderName | null => {
  if (getHeader(headers, 'x-github-event')) return 'github';
  if (getHeader(headers, 'x-gitlab-event')) return 'gitlab';

  return null;
};

export const getProvider = (providerName: CiProviderName): CiProvider => providers[providerName];
