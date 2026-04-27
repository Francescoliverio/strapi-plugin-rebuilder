export type CiProviderName = 'gitlab' | 'github';

export type BuildStatus =
  | 'success'
  | 'failed'
  | 'running'
  | 'pending'
  | 'created'
  | 'canceled'
  | 'skipped'
  | 'manual'
  | 'unknown';

export type NormalizedBuild = {
  id: number | string | null;
  stage: string | null;
  name: string | null;
  status: BuildStatus | null;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  failure_reason: string | null;
};

export type NormalizedPipeline = {
  provider: CiProviderName;
  id: number | string | null;
  iid: number | string | null;
  name?: string | null;
  status: BuildStatus;
  detailed_status: string | null;
  ref: string | null;
  sha: string | null;
  source: string | null;
  stages: string[];
  created_at: string | null;
  finished_at: string | null;
  duration: number | null;
  url: string | null;
  commit: {
    id: string | null;
    title: string | null;
    message: string | null;
    url: string | null;
  };
  triggerer: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  trigger_message?: string | null;
  builds: NormalizedBuild[];
  updated_at: string;
};

export type LastTriggerMetadata = {
  provider: CiProviderName;
  message: string | null;
  triggeredBy: string | null;
  pipelineId: number | string | null;
  pipelineUrl: string | null;
  at: string;
};

export type TriggerPipelineInput = {
  message?: string;
  triggeredBy?: string;
};

export type TriggerPipelineResult = {
  provider: CiProviderName;
  pipelineId: number | string | null;
  pipelineUrl: string | null;
  raw: any;
};

export type HandleWebhookInput = {
  headers: Record<string, any>;
  payload: any;
  rawBody?: string | Buffer | null;
  lastTrigger?: LastTriggerMetadata | null;
};

export type HandleWebhookResult =
  | {
      ignored: true;
      reason: string;
    }
  | {
      ignored?: false;
      pipeline: NormalizedPipeline;
    };

export interface CiProvider {
  name: CiProviderName;
  triggerPipeline(input: TriggerPipelineInput): Promise<TriggerPipelineResult>;
  handleWebhook(input: HandleWebhookInput): Promise<HandleWebhookResult>;
}

export type PluginSettings = {
  buildMessageTemplate: string;
  timezone: string;
  historySize: number;
  pollingIntervalSeconds: number;
  requireConfirmation: boolean;
};
