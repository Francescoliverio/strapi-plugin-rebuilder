import { BuildStatus, LastTriggerMetadata, NormalizedBuild, NormalizedPipeline } from './types';

export const buildHttpError = (status: number, message: string, details?: Record<string, unknown>) => {
  const error = new Error(message) as Error & {
    status?: number;
    details?: Record<string, unknown>;
  };

  error.status = status;
  error.details = details;

  return error;
};

export const getHeader = (headers: Record<string, any>, name: string): string | undefined => {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()] ?? headers?.[name.toUpperCase()];

  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;

  return undefined;
};

export const trimToNull = (value?: string | null, maxLength?: number): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return typeof maxLength === 'number' ? trimmed.slice(0, maxLength) : trimmed;
};

export const getFirstNonEmptyLine = (value?: string | null): string | null => {
  if (!value) return null;

  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || null
  );
};

export const diffSeconds = (start?: string | null, end?: string | null): number | null => {
  if (!start || !end) return null;

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return null;

  return (endMs - startMs) / 1000;
};

const buildKey = (build: Partial<NormalizedBuild>) =>
  build.id != null ? `id:${String(build.id)}` : `stage:${build.stage || ''}|name:${build.name || ''}`;

export const mergeBuilds = (
  existingBuilds: NormalizedBuild[] = [],
  incomingBuilds: NormalizedBuild[] = []
): NormalizedBuild[] => {
  const merged = new Map<string, NormalizedBuild>();

  [...existingBuilds, ...incomingBuilds].forEach((build) => {
    const key = buildKey(build);
    const previous = merged.get(key);

    merged.set(key, {
      ...(previous || {}),
      ...build,
      id: build.id ?? previous?.id ?? null,
      stage: build.stage ?? previous?.stage ?? null,
      name: build.name ?? previous?.name ?? null,
      status: build.status ?? previous?.status ?? 'unknown',
      started_at: build.started_at ?? previous?.started_at ?? null,
      finished_at: build.finished_at ?? previous?.finished_at ?? null,
      duration: build.duration ?? previous?.duration ?? null,
      failure_reason: build.failure_reason ?? previous?.failure_reason ?? null,
    });
  });

  return Array.from(merged.values());
};

export const deriveStages = (
  preferredStages: string[] = [],
  builds: NormalizedBuild[] = [],
  fallbackStages: string[] = []
): string[] => {
  const stages = new Set<string>();

  [...preferredStages, ...fallbackStages].forEach((stage) => {
    if (stage) stages.add(stage);
  });

  builds.forEach((build) => {
    if (build.stage) stages.add(build.stage);
  });

  return Array.from(stages);
};

export const isSamePipeline = (
  pipeline: Partial<NormalizedPipeline> | null | undefined,
  provider: string,
  pipelineId: number | string | null | undefined
): boolean => {
  if (!pipeline || pipelineId == null) return false;

  return pipeline.provider === provider && String(pipeline.id) === String(pipelineId);
};

const mergeCommit = (
  existingCommit: NormalizedPipeline['commit'] | undefined,
  incomingCommit: NormalizedPipeline['commit']
): NormalizedPipeline['commit'] => ({
  id: incomingCommit.id ?? existingCommit?.id ?? null,
  title: incomingCommit.title ?? existingCommit?.title ?? null,
  message: incomingCommit.message ?? existingCommit?.message ?? null,
  url: incomingCommit.url ?? existingCommit?.url ?? null,
});

const mergeTriggerer = (
  existingTriggerer: NormalizedPipeline['triggerer'] | undefined,
  incomingTriggerer: NormalizedPipeline['triggerer']
): NormalizedPipeline['triggerer'] => ({
  name: incomingTriggerer.name ?? existingTriggerer?.name ?? null,
  username: incomingTriggerer.username ?? existingTriggerer?.username ?? null,
  avatar_url: incomingTriggerer.avatar_url ?? existingTriggerer?.avatar_url ?? null,
});

export const attachTriggerMetadata = (
  pipeline: NormalizedPipeline,
  lastTrigger?: LastTriggerMetadata | null
): NormalizedPipeline => {
  if (!lastTrigger) return pipeline;

  const exactMatch = isSamePipeline(pipeline, lastTrigger.provider, lastTrigger.pipelineId);
  const timestampMatch =
    !exactMatch &&
    pipeline.provider === 'github' &&
    lastTrigger.provider === 'github' &&
    lastTrigger.pipelineId == null &&
    !!lastTrigger.message &&
    !!pipeline.created_at &&
    Math.abs(new Date(pipeline.created_at).getTime() - new Date(lastTrigger.at).getTime()) <=
      10 * 60 * 1000;

  if (!exactMatch && !timestampMatch) {
    return pipeline;
  }

  return {
    ...pipeline,
    trigger_message: pipeline.trigger_message ?? lastTrigger.message ?? null,
    url: pipeline.url ?? lastTrigger.pipelineUrl ?? null,
  };
};

export const mergePipeline = (
  existingPipeline: NormalizedPipeline | null | undefined,
  incomingPipeline: NormalizedPipeline,
  lastTrigger?: LastTriggerMetadata | null
): NormalizedPipeline => {
  const mergedBuilds = mergeBuilds(existingPipeline?.builds, incomingPipeline.builds);

  const mergedPipeline: NormalizedPipeline = {
    ...(existingPipeline || incomingPipeline),
    ...incomingPipeline,
    provider: incomingPipeline.provider,
    id: incomingPipeline.id ?? existingPipeline?.id ?? null,
    iid: incomingPipeline.iid ?? existingPipeline?.iid ?? null,
    name: incomingPipeline.name ?? existingPipeline?.name ?? null,
    status: incomingPipeline.status ?? existingPipeline?.status ?? 'unknown',
    detailed_status: incomingPipeline.detailed_status ?? existingPipeline?.detailed_status ?? null,
    ref: incomingPipeline.ref ?? existingPipeline?.ref ?? null,
    sha: incomingPipeline.sha ?? existingPipeline?.sha ?? null,
    source: incomingPipeline.source ?? existingPipeline?.source ?? null,
    created_at: incomingPipeline.created_at ?? existingPipeline?.created_at ?? null,
    finished_at: incomingPipeline.finished_at ?? existingPipeline?.finished_at ?? null,
    duration: incomingPipeline.duration ?? existingPipeline?.duration ?? null,
    url: incomingPipeline.url ?? existingPipeline?.url ?? null,
    commit: mergeCommit(existingPipeline?.commit, incomingPipeline.commit),
    triggerer: mergeTriggerer(existingPipeline?.triggerer, incomingPipeline.triggerer),
    trigger_message: incomingPipeline.trigger_message ?? existingPipeline?.trigger_message ?? null,
    builds: mergedBuilds,
    updated_at: incomingPipeline.updated_at || new Date().toISOString(),
    stages: deriveStages(incomingPipeline.stages, mergedBuilds, existingPipeline?.stages),
  };

  return attachTriggerMetadata(mergedPipeline, lastTrigger);
};

export const mapGitHubStatus = (
  status?: string | null,
  conclusion?: string | null
): BuildStatus => {
  switch (status) {
    case 'queued':
    case 'requested':
    case 'waiting':
    case 'pending':
      return 'pending';
    case 'in_progress':
      return 'running';
    case 'completed':
      switch (conclusion) {
        case 'success':
          return 'success';
        case 'failure':
        case 'timed_out':
        case 'startup_failure':
          return 'failed';
        case 'cancelled':
          return 'canceled';
        case 'neutral':
        case 'skipped':
        case 'stale':
          return 'skipped';
        case 'action_required':
          return 'manual';
        default:
          return 'unknown';
      }
    default:
      return 'created';
  }
};

export const formatGitHubConclusion = (conclusion?: string | null): string | null => {
  if (!conclusion) return null;
  return conclusion.replace(/_/g, ' ');
};
