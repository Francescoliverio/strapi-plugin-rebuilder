import axios from 'axios';
import crypto from 'crypto';

import {
  CiProvider,
  HandleWebhookInput,
  LastTriggerMetadata,
  NormalizedBuild,
  NormalizedPipeline,
} from '../types';
import {
  buildHttpError,
  deriveStages,
  diffSeconds,
  formatGitHubConclusion,
  getFirstNonEmptyLine,
  getHeader,
  mapGitHubStatus,
  trimToNull,
} from '../utils';

const readGitHubConfig = () => ({
  apiBaseUrl: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_API_BASE_URL) || 'https://api.github.com',
  owner: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_OWNER),
  repo: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_REPO),
  workflowId: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_WORKFLOW_ID),
  ref: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_REF) || 'main',
  token: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_TOKEN),
  webhookSecret: trimToNull(process.env.NEXJS_REBUILDER_GITHUB_WEBHOOK_SECRET),
});

const getGitHubCommitUrl = (repositoryUrl: string | null, sha: string | null) => {
  if (!repositoryUrl || !sha) return null;
  return `${repositoryUrl.replace(/\/$/, '')}/commit/${sha}`;
};

const buildGitHubTriggerer = (sender: any) => ({
  name: sender?.login ?? null,
  username: sender?.login ?? null,
  avatar_url: sender?.avatar_url ?? null,
});

const buildGitHubTriggerMessage = (
  runId: number | string | null,
  lastTrigger?: LastTriggerMetadata | null
) => {
  if (
    lastTrigger?.provider === 'github' &&
    lastTrigger?.pipelineId != null &&
    runId != null &&
    String(lastTrigger.pipelineId) === String(runId)
  ) {
    return lastTrigger.message ?? null;
  }

  return null;
};

const normalizeGitHubRun = (
  payload: any,
  lastTrigger?: LastTriggerMetadata | null
): NormalizedPipeline => {
  const run = payload?.workflow_run || {};
  const workflow = payload?.workflow || {};
  const repository = payload?.repository || {};
  const sender = payload?.sender || {};
  const commitMessage = run?.head_commit?.message ?? null;
  const commitTitle = getFirstNonEmptyLine(commitMessage) || run?.display_title || null;
  const finishedAt = run?.status === 'completed' ? run?.updated_at ?? null : null;
  const startedAt = run?.run_started_at ?? run?.created_at ?? null;

  return {
    provider: 'github',
    id: run?.id ?? null,
    iid: run?.run_number ?? null,
    name: run?.name ?? workflow?.name ?? null,
    status: mapGitHubStatus(run?.status, run?.conclusion),
    detailed_status: [run?.status, formatGitHubConclusion(run?.conclusion)].filter(Boolean).join(': ') || null,
    ref: run?.head_branch ?? null,
    sha: run?.head_sha ?? null,
    source: run?.event ?? 'workflow_dispatch',
    stages: [],
    created_at: run?.created_at ?? null,
    finished_at: finishedAt,
    duration: diffSeconds(startedAt, finishedAt),
    url: run?.html_url ?? null,
    commit: {
      id: run?.head_sha ?? null,
      title: commitTitle,
      message: commitMessage,
      url: getGitHubCommitUrl(repository?.html_url ?? null, run?.head_sha ?? null),
    },
    triggerer: buildGitHubTriggerer(sender),
    trigger_message: buildGitHubTriggerMessage(run?.id ?? null, lastTrigger),
    builds: [],
    updated_at: new Date().toISOString(),
  };
};

const normalizeGitHubJob = (
  payload: any,
  lastTrigger?: LastTriggerMetadata | null
): NormalizedPipeline => {
  const job = payload?.workflow_job || {};
  const workflowRun = payload?.workflow_run || {};
  const repository = payload?.repository || {};
  const sender = payload?.sender || {};
  const build: NormalizedBuild = {
    id: job?.id ?? null,
    stage: job?.name ?? null,
    name: job?.name ?? null,
    status: mapGitHubStatus(job?.status, job?.conclusion),
    started_at: job?.started_at ?? null,
    finished_at: job?.completed_at ?? null,
    duration: diffSeconds(job?.started_at ?? null, job?.completed_at ?? null),
    failure_reason: formatGitHubConclusion(job?.conclusion),
  };
  const runId = job?.run_id ?? workflowRun?.id ?? null;

  return {
    provider: 'github',
    id: runId,
    iid: workflowRun?.run_number ?? null,
    name: job?.workflow_name ?? workflowRun?.name ?? null,
    status: mapGitHubStatus(job?.status, job?.conclusion),
    detailed_status: [job?.status, formatGitHubConclusion(job?.conclusion)].filter(Boolean).join(': ') || null,
    ref: workflowRun?.head_branch ?? null,
    sha: workflowRun?.head_sha ?? null,
    source: workflowRun?.event ?? 'workflow_dispatch',
    stages: deriveStages([job?.name].filter(Boolean) as string[], [build]),
    created_at: job?.started_at ?? null,
    finished_at: job?.status === 'completed' ? job?.completed_at ?? null : null,
    duration: diffSeconds(job?.started_at ?? null, job?.completed_at ?? null),
    url: workflowRun?.html_url ?? null,
    commit: {
      id: workflowRun?.head_sha ?? null,
      title: workflowRun?.display_title ?? null,
      message: workflowRun?.head_commit?.message ?? null,
      url: getGitHubCommitUrl(repository?.html_url ?? null, workflowRun?.head_sha ?? null),
    },
    triggerer: buildGitHubTriggerer(sender),
    trigger_message: buildGitHubTriggerMessage(runId, lastTrigger),
    builds: [build],
    updated_at: new Date().toISOString(),
  };
};

const safeCompareSignatures = (expected: string, received: string) => {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const getRawBodyBuffer = (rawBody?: string | Buffer | null) => {
  if (!rawBody) return null;
  return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
};

export const githubProvider: CiProvider = {
  name: 'github',

  async triggerPipeline({ message, triggeredBy }) {
    const config = readGitHubConfig();

    if (!config.owner || !config.repo || !config.workflowId || !config.token) {
      throw buildHttpError(
        500,
        'GitHub provider is misconfigured: missing owner, repo, workflow ID, or token.',
        {
          hasOwner: !!config.owner,
          hasRepo: !!config.repo,
          hasWorkflowId: !!config.workflowId,
          hasToken: !!config.token,
        }
      );
    }

    const trimmedMessage = trimToNull(message, 500);
    const trimmedBy = trimToNull(triggeredBy, 200);
    const inputs: Record<string, string> = {};

    if (trimmedMessage) inputs.build_message = trimmedMessage;
    if (trimmedBy) inputs.triggered_by = trimmedBy;

    const { data } = await axios.post(
      `${config.apiBaseUrl.replace(/\/$/, '')}/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(
        config.workflowId
      )}/dispatches`,
      {
        ref: config.ref,
        inputs,
      },
      {
        params: {
          return_run_details: true,
        },
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${config.token}`,
        },
      }
    );

    return {
      provider: 'github',
      pipelineId: data?.workflow_run_id ?? null,
      pipelineUrl: data?.html_url ?? null,
      raw: data ?? null,
    };
  },

  async handleWebhook({ headers, payload, rawBody, lastTrigger }: HandleWebhookInput) {
    const config = readGitHubConfig();

    if (!config.webhookSecret) {
      throw buildHttpError(500, 'GitHub webhook secret is not configured.');
    }

    const signature = getHeader(headers, 'x-hub-signature-256');
    if (!signature) {
      throw buildHttpError(401, 'Missing GitHub webhook signature.');
    }

    const rawBodyBuffer = getRawBodyBuffer(rawBody);
    if (!rawBodyBuffer) {
      throw buildHttpError(
        500,
        'GitHub webhook verification requires access to the raw request body. Enable `includeUnparsed: true` in Strapi body middleware.'
      );
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', config.webhookSecret)
      .update(rawBodyBuffer)
      .digest('hex')}`;

    if (!safeCompareSignatures(expectedSignature, signature)) {
      throw buildHttpError(401, 'Invalid GitHub webhook signature.');
    }

    const event = getHeader(headers, 'x-github-event');
    if (event === 'ping') {
      return {
        ignored: true,
        reason: 'Ping event received.',
      };
    }

    if (event === 'workflow_run') {
      return {
        pipeline: normalizeGitHubRun(payload, lastTrigger),
      };
    }

    if (event === 'workflow_job') {
      return {
        pipeline: normalizeGitHubJob(payload, lastTrigger),
      };
    }

    return {
      ignored: true,
      reason: `Event "${event}" not handled.`,
    };
  },
};
