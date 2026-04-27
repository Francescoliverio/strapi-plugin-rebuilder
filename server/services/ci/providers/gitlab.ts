import axios from 'axios';

import { CiProvider, HandleWebhookInput, LastTriggerMetadata, NormalizedBuild, NormalizedPipeline } from '../types';
import { buildHttpError, deriveStages, getHeader, trimToNull } from '../utils';

const readGitLabConfig = () => ({
  apiBaseUrl: trimToNull(process.env.NEXJS_REBUILDER_GITLAB_API_BASE_URL) || 'https://gitlab.com/api/v4',
  projectId:
    trimToNull(process.env.NEXJS_REBUILDER_GITLAB_PROJECT_ID) ||
    trimToNull(process.env.STRAPI_ADMIN_GITLAB_PROJECT_ID),
  triggerToken:
    trimToNull(process.env.NEXJS_REBUILDER_GITLAB_TRIGGER_TOKEN) ||
    trimToNull(process.env.STRAPI_ADMIN_GITLAB_PIPELINE_TRIGGER_TOKEN),
  webhookSecret:
    trimToNull(process.env.NEXJS_REBUILDER_GITLAB_WEBHOOK_SECRET) ||
    trimToNull(process.env.STRAPI_GITLAB_WEBHOOK_SECRET),
  ref: trimToNull(process.env.NEXJS_REBUILDER_GITLAB_REF) || 'main',
});

const pickBuild = (build: any): NormalizedBuild => ({
  id: build?.id ?? null,
  stage: build?.stage ?? null,
  name: build?.name ?? null,
  status: build?.status ?? null,
  started_at: build?.started_at ?? null,
  finished_at: build?.finished_at ?? null,
  duration: build?.duration ?? null,
  failure_reason: build?.failure_reason ?? null,
});

const normalizeGitLabPipeline = (
  payload: any,
  lastTrigger?: LastTriggerMetadata | null
): NormalizedPipeline => {
  const attrs = payload?.object_attributes || {};
  const commit = payload?.commit || {};
  const user = payload?.user || {};
  const builds = Array.isArray(payload?.builds) ? payload.builds.map(pickBuild) : [];
  const pipelineId = attrs.id ?? null;
  const triggerMessage =
    lastTrigger?.provider === 'gitlab' && lastTrigger?.pipelineId != null && String(lastTrigger.pipelineId) === String(pipelineId)
      ? lastTrigger?.message ?? null
      : null;

  return {
    provider: 'gitlab',
    id: pipelineId,
    iid: attrs.iid ?? null,
    name: attrs.name ?? null,
    status: attrs.status ?? 'unknown',
    detailed_status: attrs.detailed_status ?? null,
    ref: attrs.ref ?? null,
    sha: attrs.sha ?? null,
    source: attrs.source ?? null,
    stages: deriveStages(Array.isArray(attrs.stages) ? attrs.stages : [], builds),
    created_at: attrs.created_at ?? null,
    finished_at: attrs.finished_at ?? null,
    duration: attrs.duration ?? null,
    url: attrs.url ?? null,
    commit: {
      id: commit.id ?? null,
      title: commit.title ?? null,
      message: commit.message ?? null,
      url: commit.url ?? null,
    },
    triggerer: {
      name: user.name ?? null,
      username: user.username ?? null,
      avatar_url: user.avatar_url ?? null,
    },
    trigger_message: triggerMessage,
    builds,
    updated_at: new Date().toISOString(),
  };
};

export const gitlabProvider: CiProvider = {
  name: 'gitlab',

  async triggerPipeline({ message, triggeredBy }) {
    const config = readGitLabConfig();

    if (!config.projectId || !config.triggerToken) {
      throw buildHttpError(
        500,
        'GitLab provider is misconfigured: missing project ID or trigger token.',
        {
          hasProjectId: !!config.projectId,
          hasTriggerToken: !!config.triggerToken,
        }
      );
    }

    const trimmedMessage = trimToNull(message, 500);
    const trimmedBy = trimToNull(triggeredBy, 200);

    const params = new URLSearchParams();
    params.append('token', config.triggerToken);
    params.append('ref', config.ref);
    if (trimmedMessage) params.append('variables[BUILD_MESSAGE]', trimmedMessage);
    if (trimmedBy) params.append('variables[TRIGGERED_BY]', trimmedBy);

    const { data } = await axios.post(
      `${config.apiBaseUrl.replace(/\/$/, '')}/projects/${config.projectId}/trigger/pipeline`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    return {
      provider: 'gitlab',
      pipelineId: data?.id ?? null,
      pipelineUrl: data?.web_url ?? null,
      raw: data,
    };
  },

  async handleWebhook({ headers, payload, lastTrigger }: HandleWebhookInput) {
    const config = readGitLabConfig();

    if (!config.webhookSecret) {
      throw buildHttpError(500, 'GitLab webhook secret is not configured.');
    }

    const receivedSecret = getHeader(headers, 'x-gitlab-token');
    if (receivedSecret !== config.webhookSecret) {
      throw buildHttpError(401, 'Invalid GitLab webhook secret.');
    }

    const event = getHeader(headers, 'x-gitlab-event');
    if (event !== 'Pipeline Hook') {
      return {
        ignored: true,
        reason: `Event "${event}" not handled.`,
      };
    }

    return {
      pipeline: normalizeGitLabPipeline(payload, lastTrigger),
    };
  },
};
