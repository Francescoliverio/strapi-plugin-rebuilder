/*
 *
 * HomePage
 *
 */

import { isNil, upperFirst } from "lodash";
import React from "react";
import styled, { keyframes, useTheme } from "styled-components";

import {
  Badge,
  Box,
  Button,
  Checkbox,
  Divider,
  Flex,
  IconButton,
  Link,
  Loader,
  TextInput,
  Tooltip,
  Typography,
} from "@strapi/design-system";
import { Cog } from "@strapi/icons";

import axiosInstance from "../../utils/axiosInstance";
import { Information, Refresh } from "../../utils/icons";
import pluginPkg from "../../../../package.json";

const PLUGIN_VERSION: string = (pluginPkg as { version: string }).version;
const README_REPO_URL = "https://github.com/Francescoliverio/strapi-plugin-rebuilder";

type BuildStatus =
  | "success"
  | "failed"
  | "running"
  | "pending"
  | "created"
  | "canceled"
  | "skipped"
  | "manual"
  | "unknown";

type Build = {
  id: number | string | null;
  stage: string | null;
  name: string | null;
  status: BuildStatus | null;
  started_at: string | null;
  finished_at: string | null;
  duration: number | null;
  failure_reason: string | null;
};

type Pipeline = {
  provider?: "gitlab" | "github" | null;
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
  builds: Build[];
};

const STATUS_COLOR: Record<string, string> = {
  success: "#108548",
  failed: "#dd2b0e",
  running: "#1f75cb",
  pending: "#ef8e50",
  canceled: "#737278",
  skipped: "#737278",
  manual: "#737278",
  created: "#bfbfc3",
  unknown: "#bfbfc3",
};

const STATUS_LABEL: Record<string, string> = {
  success: "Passed",
  failed: "Failed",
  running: "Running",
  pending: "Pending",
  canceled: "Canceled",
  skipped: "Skipped",
  manual: "Manual",
  created: "Created",
  unknown: "Unknown",
};

const deriveStageStatus = (builds: Build[], stageName: string): BuildStatus => {
  const stageBuilds = builds.filter((b) => b.stage === stageName);
  if (stageBuilds.length === 0) return "created";
  if (stageBuilds.some((b) => b.status === "failed")) return "failed";
  if (stageBuilds.some((b) => b.status === "running")) return "running";
  if (stageBuilds.some((b) => b.status === "pending" || b.status === "created")) return "pending";
  if (stageBuilds.some((b) => b.status === "canceled")) return "canceled";
  if (stageBuilds.every((b) => b.status === "success" || b.status === "skipped" || b.status === "manual"))
    return "success";
  return "created";
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds && seconds !== 0) return "—";
  const s = Math.round(seconds);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
};

const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

type Settings = {
  buildMessageTemplate: string;
  timezone: string;
  historySize: number;
  pollingIntervalSeconds: number;
  requireConfirmation: boolean;
};

const DEFAULT_SETTINGS: Settings = {
  buildMessageTemplate: "Release_{HH}_{mm}__{dd}_{MM}_{YYYY}",
  timezone: "",
  historySize: 10,
  pollingIntervalSeconds: 6,
  requireConfirmation: false,
};

const extractDateParts = (date: Date, timezone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const lookup = (type: string) =>
      parts.find((p) => p.type === type)?.value.padStart(2, "0") || "00";
    return {
      YYYY: lookup("year"),
      MM: lookup("month"),
      dd: lookup("day"),
      HH: lookup("hour") === "24" ? "00" : lookup("hour"),
      mm: lookup("minute"),
      ss: lookup("second"),
    };
  } catch {
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      YYYY: String(date.getFullYear()),
      MM: pad(date.getMonth() + 1),
      dd: pad(date.getDate()),
      HH: pad(date.getHours()),
      mm: pad(date.getMinutes()),
      ss: pad(date.getSeconds()),
    };
  }
};

const generateBuildMessage = (
  template: string = DEFAULT_SETTINGS.buildMessageTemplate,
  timezone: string = "",
  date: Date = new Date()
): string => {
  const parts = extractDateParts(date, timezone);
  return template.replace(/\{(YYYY|MM|dd|HH|mm|ss)\}/g, (_, token) => (parts as any)[token]);
};

const getFirstNonEmptyLine = (value?: string | null): string | null => {
  if (!value) return null;

  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || null
  );
};

const getPipelineDisplayMessage = (pipeline: Pipeline): string => {
  return (
    pipeline.trigger_message?.trim() ||
    pipeline.name?.trim() ||
    getFirstNonEmptyLine(pipeline.commit?.message) ||
    pipeline.commit?.title?.trim() ||
    "—"
  );
};

const getProviderLabel = (provider?: Pipeline["provider"]) => {
  if (provider === "github") return "GitHub";
  return "GitLab";
};

const formatSourceLabel = (source?: string | null) => {
  if (!source) return null;
  if (source === "trigger") return "trigger token";
  return source.replace(/_/g, " ");
};

type LabeledTextInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> & {
  label: string;
  hint?: React.ReactNode;
  endAction?: React.ReactNode;
};

const LabeledTextInput = React.forwardRef<HTMLInputElement, LabeledTextInputProps>(
  ({ label, hint, name, id, "aria-label": ariaLabel, ...inputProps }, ref) => {
    const inputId = id || name || undefined;
    return (
      <Flex direction="column" alignItems="stretch" gap={1}>
        <Typography
          variant="pi"
          fontWeight="bold"
          textColor="neutral800"
          tag="label"
          {...(inputId ? { htmlFor: inputId } : {})}
        >
          {label}
        </Typography>
        <TextInput
          ref={ref}
          id={inputId}
          name={name}
          aria-label={ariaLabel || label}
          {...inputProps}
        />
        {hint && (
          <Typography variant="pi" textColor="neutral600">
            {hint}
          </Typography>
        )}
      </Flex>
    );
  }
);

const ReadmeScrollContainer = styled.div`
  max-height: 600px;
  overflow-y: auto;
  padding: 0 16px;

  .markdown-body {
    background: transparent !important;
  }
`;

const isDarkTheme = (theme: any): boolean => {
  const bg = theme?.colors?.neutral0;
  if (typeof bg !== 'string') return false;
  const hex = bg.replace(/^#/, '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
};

const StageButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 4px;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;

  &:hover {
    background: ${({ theme }) => theme.colors.neutral150};
    transform: scale(1.04);
  }

  &:focus-visible {
    outline: none;
    background: ${({ theme }) => theme.colors.primary100};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.primary600};
  }
`;

const StageConnector = styled.span`
  width: 16px;
  height: 3px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.neutral200};
  display: inline-block;
`;

const StatusIcon: React.FC<{ status: BuildStatus; size?: number }> = ({ status, size = 16 }) => {
  const color = STATUS_COLOR[status] || STATUS_COLOR.unknown;
  const iconShapes: Record<string, React.ReactNode> = {
    success: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M6.8 10.3 4.5 8l-1 1 3.3 3.3L12.5 7 11.5 6z" fill="#fff" />
      </>
    ),
    failed: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path
          d="M10.5 4.5 8 7 5.5 4.5 4.5 5.5 7 8 4.5 10.5 5.5 11.5 8 9 10.5 11.5 11.5 10.5 9 8 11.5 5.5z"
          fill="#fff"
        />
      </>
    ),
    running: (
      <>
        <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="2" strokeDasharray="20 20" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="1.4s" repeatCount="indefinite" />
        </circle>
      </>
    ),
    pending: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <circle cx="4.5" cy="8" r="1" fill="#fff" />
        <circle cx="8" cy="8" r="1" fill="#fff" />
        <circle cx="11.5" cy="8" r="1" fill="#fff" />
      </>
    ),
    canceled: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M4.5 4.5 5.5 3.5l7 7-1 1z" fill="#fff" />
      </>
    ),
    skipped: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <path d="M6.5 4.5v7l5-3.5z" fill="#fff" />
      </>
    ),
    manual: (
      <>
        <circle cx="8" cy="8" r="7" fill={color} />
        <rect x="4" y="7" width="8" height="2" fill="#fff" />
        <rect x="7" y="4" width="2" height="8" fill="#fff" />
      </>
    ),
    created: (
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
    ),
    unknown: (
      <circle cx="8" cy="8" r="6.5" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ display: "block" }}
      aria-label={`Status: ${STATUS_LABEL[status] || status}`}
    >
      {iconShapes[status] || iconShapes.unknown}
    </svg>
  );
};

const StageTooltipContent: React.FC<{ stage: string; status: BuildStatus; builds: Build[] }> = ({
  stage,
  status,
  builds,
}) => (
  <Box style={{ minWidth: 180, maxWidth: 260 }}>
    <Typography variant="pi" fontWeight="bold" textColor="neutral0">
      Stage: {stage} — {STATUS_LABEL[status] || status}
    </Typography>
    {builds.length > 0 && (
      <Box paddingTop={2}>
        {builds.map((b) => (
          <Flex key={b.id} gap={2} alignItems="center" paddingTop={1} paddingBottom={1}>
            <StatusIcon status={(b.status as BuildStatus) || "unknown"} size={12} />
            <Typography variant="pi" ellipsis textColor="neutral0">
              {b.name || `#${b.id}`}
            </Typography>
          </Flex>
        ))}
      </Box>
    )}
  </Box>
);

const StagesGraph: React.FC<{ pipeline: Pipeline }> = ({ pipeline }) => {
  if (!pipeline.stages || pipeline.stages.length === 0) return null;
  return (
    <Flex gap={1} alignItems="center">
      {pipeline.stages.map((stage, idx) => {
        const stageStatus = deriveStageStatus(pipeline.builds, stage);
        const stageBuilds = pipeline.builds.filter((b) => b.stage === stage);
        return (
          <React.Fragment key={stage}>
            <Tooltip
              description={
                <StageTooltipContent stage={stage} status={stageStatus} builds={stageBuilds} />
              }
            >
              <StageButton
                type="button"
                aria-label={`Stage: ${stage} — ${STATUS_LABEL[stageStatus] || stageStatus}`}
              >
                <StatusIcon status={stageStatus} size={20} />
              </StageButton>
            </Tooltip>
            {idx < pipeline.stages.length - 1 && <StageConnector />}
          </React.Fragment>
        );
      })}
    </Flex>
  );
};

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

const SkeletonBar = styled.div<{ width: string; height?: number }>`
  width: ${({ width }) => width};
  height: ${({ height = 12 }) => `${height}px`};
  border-radius: 4px;
  background: ${({ theme }) => theme.colors.neutral150};
  animation: ${pulse} 1.4s ease-in-out infinite;
`;

const SkeletonDot = styled.div`
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.neutral150};
  animation: ${pulse} 1.4s ease-in-out infinite;
`;

const PendingPipelineRow: React.FC<{ message: string; provider: "gitlab" | "github" }> = ({
  message,
  provider,
}) => (
  <Box
    paddingTop={4}
    paddingBottom={4}
    paddingLeft={4}
    paddingRight={4}
    background="neutral0"
    hasRadius
    shadow="tableShadow"
    style={{ marginBottom: 8 }}
  >
    <Flex gap={6} alignItems="flex-start" wrap="wrap">
      <Flex direction="column" alignItems="flex-start" gap={2} style={{ minWidth: 140 }}>
        <Flex gap={2} alignItems="center">
          <SkeletonDot />
          <Typography variant="omega" fontWeight="semiBold" textColor="neutral600">
            Triggering…
          </Typography>
        </Flex>
        <SkeletonBar width="80px" />
        <SkeletonBar width="60px" />
      </Flex>

      <Flex direction="column" alignItems="flex-start" gap={2} style={{ flex: 1, minWidth: 240 }}>
        <SkeletonBar width="60px" />
        <Typography variant="omega" fontWeight="bold" ellipsis>
          {message}
        </Typography>
        <Flex gap={2} wrap="wrap">
          <Badge backgroundColor="neutral100">{getProviderLabel(provider)}</Badge>
          <SkeletonBar width="50px" height={18} />
          <SkeletonBar width="70px" height={18} />
        </Flex>
        <Typography variant="pi" textColor="neutral600">
          Waiting for the first webhook event from {getProviderLabel(provider)}…
        </Typography>
      </Flex>

      <Flex direction="column" alignItems="flex-start" gap={2} style={{ minWidth: 180 }}>
        <SkeletonBar width="60px" height={10} />
        <Flex gap={2}>
          <SkeletonDot />
          <SkeletonDot />
          <SkeletonDot />
          <SkeletonDot />
        </Flex>
      </Flex>
    </Flex>
  </Box>
);

const PipelineRow: React.FC<{ pipeline: Pipeline }> = ({ pipeline }) => {
  const shortSha = pipeline.sha ? pipeline.sha.slice(0, 8) : "—";
  const color = STATUS_COLOR[pipeline.status] || STATUS_COLOR.unknown;
  const displayMessage = getPipelineDisplayMessage(pipeline);
  const sourceLabel = formatSourceLabel(pipeline.source);
  const stageLabel = pipeline.provider === "github" ? "Jobs" : "Stages";

  return (
    <Box
      paddingTop={4}
      paddingBottom={4}
      paddingLeft={4}
      paddingRight={4}
      background="neutral0"
      hasRadius
      shadow="tableShadow"
      style={{ marginBottom: 8 }}
    >
      <Flex gap={6} alignItems="flex-start" wrap="wrap">
        <Flex direction="column" alignItems="flex-start" gap={1} style={{ minWidth: 140 }}>
          <Flex gap={2} alignItems="center">
            <StatusIcon status={pipeline.status} size={18} />
            <Typography variant="omega" fontWeight="semiBold" style={{ color }}>
              {STATUS_LABEL[pipeline.status] || upperFirst(pipeline.status)}
            </Typography>
          </Flex>
          <Typography variant="pi" textColor="neutral600">
            ⏱ {formatDuration(pipeline.duration)}
          </Typography>
          <Typography variant="pi" textColor="neutral600">
            {formatRelativeTime(pipeline.finished_at || pipeline.created_at)}
          </Typography>
        </Flex>

        <Flex direction="column" alignItems="flex-start" gap={1} style={{ flex: 1, minWidth: 240 }}>
          {pipeline.url ? (
            <Link href={pipeline.url} isExternal>
              #{pipeline.id}
            </Link>
          ) : (
            <Typography variant="omega">#{pipeline.id}</Typography>
          )}
          <Typography variant="omega" fontWeight="bold" ellipsis>
            {displayMessage}
          </Typography>
          <Flex gap={2} wrap="wrap">
            <Badge backgroundColor="neutral100">{getProviderLabel(pipeline.provider)}</Badge>
            <Badge>{pipeline.ref || "—"}</Badge>
            {pipeline.commit?.url ? (
              <Link href={pipeline.commit.url} isExternal>
                <code style={{ fontSize: 12 }}>{shortSha}</code>
              </Link>
            ) : (
              <code style={{ fontSize: 12 }}>{shortSha}</code>
            )}
            {sourceLabel && <Badge backgroundColor="primary100">{sourceLabel}</Badge>}
          </Flex>
          {pipeline.triggerer?.name && (
            <Typography variant="pi" textColor="neutral600">
              by {pipeline.triggerer.name}
            </Typography>
          )}
        </Flex>

        <Flex direction="column" alignItems="flex-start" gap={2} style={{ minWidth: 180 }}>
          <Typography variant="pi" textColor="neutral600" fontWeight="bold">
            {stageLabel}
          </Typography>
          <StagesGraph pipeline={pipeline} />
        </Flex>
      </Flex>
    </Box>
  );
};

const usePipelinePolling = (intervalSeconds: number) => {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<any>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await axiosInstance.get("/nexjs-rebuilder/pipeline-status");
        if (!cancelled) {
          setData(res.data);
          setError(null);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
        }
      }
    };

    fetchData();
    const id = setInterval(fetchData, Math.max(1, intervalSeconds) * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalSeconds]);

  return { data, error, isLoading };
};

const HomePage: React.VoidFunctionComponent = () => {
  const [btnEnabled, setBtnEnabled] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [settingsDraft, setSettingsDraft] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [settingsSaving, setSettingsSaving] = React.useState(false);
  const [settingsMessage, setSettingsMessage] = React.useState<string | null>(null);
  const [buildMessage, setBuildMessage] = React.useState(() => generateBuildMessage());
  const [readmeOpen, setReadmeOpen] = React.useState(false);
  const [readmeHtml, setReadmeHtml] = React.useState<string | null>(null);
  const [readmeLoading, setReadmeLoading] = React.useState(false);
  const [readmeError, setReadmeError] = React.useState<string | null>(null);
  const [pendingTrigger, setPendingTrigger] = React.useState<{
    message: string;
    triggeredAt: number;
    previousLatestId: string | null;
  } | null>(null);

  const theme = useTheme();
  const themeMode: "light" | "dark" = isDarkTheme(theme) ? "dark" : "light";

  const handleToggleSettings = () => {
    setSettingsOpen((v) => {
      const next = !v;
      if (next) setReadmeOpen(false);
      return next;
    });
  };

  const handleToggleReadme = () => {
    setReadmeOpen((v) => {
      const next = !v;
      if (next) setSettingsOpen(false);
      return next;
    });
  };

  const fetchReadme = React.useCallback(async () => {
    setReadmeLoading(true);
    setReadmeError(null);
    try {
      const { data } = await axiosInstance.get(
        `/nexjs-rebuilder/readme?theme=${themeMode}`
      );
      setReadmeHtml(data?.html || "");
    } catch (err: any) {
      setReadmeError(err?.response?.data?.error?.message || err?.message || "Failed to load README.");
    } finally {
      setReadmeLoading(false);
    }
  }, [themeMode]);

  React.useEffect(() => {
    if (readmeHtml) {
      setReadmeHtml(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeMode]);

  React.useEffect(() => {
    if (readmeOpen && !readmeHtml && !readmeLoading) {
      fetchReadme();
    }
  }, [readmeOpen, readmeHtml, readmeLoading, fetchReadme]);

  React.useEffect(() => {
    let cancelled = false;
    axiosInstance
      .get("/nexjs-rebuilder/settings")
      .then(({ data }) => {
        if (cancelled) return;
        const loaded: Settings = { ...DEFAULT_SETTINGS, ...data };
        setSettings(loaded);
        setSettingsDraft(loaded);
        setBuildMessage(generateBuildMessage(loaded.buildMessageTemplate, loaded.timezone));
      })
      .catch(() => {
        // Keep defaults on error; don't block the page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRegenerate = () => {
    setBuildMessage(generateBuildMessage(settings.buildMessageTemplate, settings.timezone));
  };

  const handleSubmitRebuild = async () => {
    if (settings.requireConfirmation) {
      const ok = window.confirm(
        `Trigger a rebuild with message:\n\n${buildMessage.trim() || "(empty)"}\n\nProceed?`
      );
      if (!ok) return;
    }

    const trimmed = buildMessage.trim();
    const previousLatestId =
      data?.history?.[0]?.id != null ? String(data.history[0].id) : null;
    setBtnEnabled(false);
    setError(null);
    setPendingTrigger({
      message: trimmed || "(no message)",
      triggeredAt: Date.now(),
      previousLatestId,
    });

    try {
      await axiosInstance.post("/nexjs-rebuilder/trigger-pipeline", {
        message: trimmed || undefined,
      });
      setBuildMessage(generateBuildMessage(settings.buildMessageTemplate, settings.timezone));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Failed to trigger pipeline.");
      setPendingTrigger(null);
    }
  };

  const handleSettingsSave = async () => {
    setSettingsSaving(true);
    setSettingsMessage(null);
    try {
      const { data } = await axiosInstance.put("/nexjs-rebuilder/settings", settingsDraft);
      const saved: Settings = { ...DEFAULT_SETTINGS, ...data };
      setSettings(saved);
      setSettingsDraft(saved);
      setBuildMessage(generateBuildMessage(saved.buildMessageTemplate, saved.timezone));
      setSettingsMessage("Settings saved.");
    } catch (err: any) {
      setSettingsMessage(err?.response?.data?.error?.message || "Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleSettingsReset = () => {
    setSettingsDraft(DEFAULT_SETTINGS);
  };

  const { isLoading, data, error: queryError } = usePipelinePolling(
    settings.pollingIntervalSeconds
  );

  React.useEffect(() => {
    if (queryError) {
      setError((queryError as any)?.response?.data?.error?.message || "Failed to fetch pipeline status.");
    }
  }, [queryError]);

  const status: BuildStatus = data?.status || "unknown";
  const hasData = !isLoading && !isNil(data) && status && status !== "unknown";
  const lastTrigger = data?.lastTrigger;
  const history: Pipeline[] = (data?.history || []).map((pipeline: Pipeline) =>
    lastTrigger?.pipelineId === pipeline.id && lastTrigger?.message && !pipeline.trigger_message
      ? { ...pipeline, trigger_message: lastTrigger.message }
      : pipeline
  );

  React.useEffect(() => {
    setBtnEnabled(!["running", "pending"].includes(status));
    return () => setBtnEnabled(false);
  }, [status]);

  React.useEffect(() => {
    if (!pendingTrigger) return;

    // GitLab: lastTrigger.pipelineId is set immediately, match by id when it
    // shows up in history.
    const pipelineIdMatch =
      lastTrigger?.pipelineId != null &&
      history.some((p) => String(p.id) === String(lastTrigger.pipelineId));

    // Cross-provider: a new pipeline appeared at the top of history that was
    // not the latest one when we clicked Rebuild. Clock-skew safe.
    const latestIdNow =
      history[0]?.id != null ? String(history[0].id) : null;
    const newPipelineDetected =
      latestIdNow != null && latestIdNow !== pendingTrigger.previousLatestId;

    if (pipelineIdMatch || newPipelineDetected) {
      setPendingTrigger(null);
    }
  }, [history, lastTrigger, pendingTrigger]);

  React.useEffect(() => {
    if (!pendingTrigger) return;
    // Long fallback for environments where the webhook is delayed or
    // unreachable (e.g. local Strapi with no public tunnel).
    const timeoutId = setTimeout(() => setPendingTrigger(null), 5 * 60 * 1000);
    return () => clearTimeout(timeoutId);
  }, [pendingTrigger]);

  const pendingProvider: "gitlab" | "github" =
    (data?.provider as "gitlab" | "github") ||
    (history[0]?.provider as "gitlab" | "github") ||
    "gitlab";

  return (
    <Box background="neutral100">
      <Box paddingTop={10} paddingLeft={10} paddingRight={10} paddingBottom={6}>
        <Flex justifyContent="space-between" alignItems="center">
          <Typography variant="alpha" tag="h1">
            Rebuilder
          </Typography>
          <Flex gap={3} alignItems="center">
            <Badge backgroundColor="neutral150" textColor="neutral700">
              v{PLUGIN_VERSION}
            </Badge>
            <Flex gap={2}>
              <Tooltip description={readmeOpen ? "Hide documentation" : "Plugin documentation"}>
                <IconButton
                  onClick={handleToggleReadme}
                  label="Plugin documentation"
                >
                  <Information aria-hidden />
                </IconButton>
              </Tooltip>
              <Tooltip description={settingsOpen ? "Hide settings" : "Plugin settings"}>
                <IconButton
                  onClick={handleToggleSettings}
                  label="Plugin settings"
                >
                  <Cog aria-hidden />
                </IconButton>
              </Tooltip>
            </Flex>
          </Flex>
        </Flex>
      </Box>

      <Box paddingLeft={10} paddingRight={10} paddingBottom={10}>
        {error && (
          <Box paddingTop={2} paddingBottom={4}>
            <Typography variant="omega" textColor="danger600">
              {error}
            </Typography>
          </Box>
        )}

        <Box
          background="neutral0"
          hasRadius
          shadow="tableShadow"
          padding={6}
          style={{ marginBottom: 24 }}
        >
          <Flex gap={4} alignItems="center" paddingBottom={5}>
            <Typography variant="pi" textColor="neutral600" fontWeight="bold">
              CURRENT STATUS
            </Typography>
            {isLoading && !queryError ? (
              <Loader small>Loading...</Loader>
            ) : queryError && isNil(data) ? (
              <Typography variant="beta" textColor="danger600" style={{ fontWeight: 700 }}>
                Unavailable
              </Typography>
            ) : (
              <Flex gap={2} alignItems="center">
                <StatusIcon status={status} size={24} />
                <Typography
                  variant="beta"
                  style={{ color: STATUS_COLOR[status] || "inherit", fontWeight: 700 }}
                >
                  {hasData ? STATUS_LABEL[status] || upperFirst(status) : "No data yet"}
                </Typography>
              </Flex>
            )}
          </Flex>

          <Divider />

          <Box paddingTop={5}>
            <Flex gap={3} alignItems="flex-end">
              <Box style={{ flex: 1 }}>
                <LabeledTextInput
                  name="build-message"
                  label="Build message"
                  value={buildMessage}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setBuildMessage(e.target.value)
                  }
                  disabled={!btnEnabled}
                  placeholder="Release_14_32__24_04_2026"
                  endAction={
                    <IconButton
                      onClick={handleRegenerate}
                      label="Regenerate timestamp"
                      variant="ghost"
                      disabled={!btnEnabled}
                    >
                      <Refresh aria-hidden />
                    </IconButton>
                  }
                />
              </Box>
              <Box style={{ paddingLeft: 12 }}>
                <Button
                  onClick={handleSubmitRebuild}
                  disabled={!btnEnabled}
                  loading={["running", "pending"].includes(status)}
                  size="L"
                >
                  Rebuild
                </Button>
              </Box>
            </Flex>
          </Box>

        </Box>

        {readmeOpen && (
          <Box
            background="neutral0"
            hasRadius
            shadow="tableShadow"
            padding={6}
            style={{ marginBottom: 24 }}
          >
            <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
              <Typography variant="delta" tag="h3">
                Documentation
              </Typography>
              <Flex gap={2} alignItems="center">
                <Link href={README_REPO_URL} isExternal>
                  View on GitHub
                </Link>
                <IconButton
                  onClick={fetchReadme}
                  label="Refresh documentation"
                  disabled={readmeLoading}
                >
                  <Refresh aria-hidden />
                </IconButton>
              </Flex>
            </Flex>

            <Divider />

            <Box paddingTop={5}>
              {readmeLoading && (
                <Flex justifyContent="center" paddingTop={4} paddingBottom={4}>
                  <Loader>Fetching README from GitHub…</Loader>
                </Flex>
              )}
              {readmeError && !readmeLoading && (
                <Typography variant="omega" textColor="danger600">
                  {readmeError}
                </Typography>
              )}
              {readmeHtml && !readmeLoading && (
                <ReadmeScrollContainer
                  dangerouslySetInnerHTML={{ __html: readmeHtml }}
                />
              )}
            </Box>
          </Box>
        )}

        {settingsOpen && (
          <Box
            background="neutral0"
            hasRadius
            shadow="tableShadow"
            padding={6}
            style={{ marginBottom: 24 }}
          >
            <Flex justifyContent="space-between" alignItems="center" paddingBottom={4}>
              <Typography variant="delta" tag="h3">
                Plugin settings
              </Typography>
              {settingsMessage && (
                <Typography variant="pi" textColor="neutral600">
                  {settingsMessage}
                </Typography>
              )}
            </Flex>

            <Divider />

            <Box paddingTop={5}>
              <Flex direction="column" gap={4} alignItems="stretch">
                <LabeledTextInput
                  name="buildMessageTemplate"
                  label="Build message template"
                  hint="Tokens: {YYYY} {MM} {dd} {HH} {mm} {ss}"
                  value={settingsDraft.buildMessageTemplate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettingsDraft({ ...settingsDraft, buildMessageTemplate: e.target.value })
                  }
                  placeholder="Release_{HH}_{mm}__{dd}_{MM}_{YYYY}"
                />

                <LabeledTextInput
                  name="timezone"
                  label="Timezone"
                  hint="IANA timezone (e.g. Europe/Rome, UTC). Leave empty for browser local time."
                  value={settingsDraft.timezone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettingsDraft({ ...settingsDraft, timezone: e.target.value })
                  }
                  placeholder="UTC"
                />

                <Flex gap={4} alignItems="flex-start">
                  <Box style={{ flex: 1 }}>
                    <LabeledTextInput
                      name="historySize"
                      label="History size"
                      hint="How many recent builds to keep (5–50)."
                      type="number"
                      value={String(settingsDraft.historySize)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          historySize: Number(e.target.value) || DEFAULT_SETTINGS.historySize,
                        })
                      }
                    />
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <LabeledTextInput
                      name="pollingIntervalSeconds"
                      label="Polling interval (s)"
                      hint="How often the UI refreshes pipeline status (3–60)."
                      type="number"
                      value={String(settingsDraft.pollingIntervalSeconds)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSettingsDraft({
                          ...settingsDraft,
                          pollingIntervalSeconds:
                            Number(e.target.value) || DEFAULT_SETTINGS.pollingIntervalSeconds,
                        })
                      }
                    />
                  </Box>
                </Flex>

                <Checkbox
                  name="requireConfirmation"
                  value={settingsDraft.requireConfirmation}
                  onValueChange={(value: boolean) =>
                    setSettingsDraft({ ...settingsDraft, requireConfirmation: value })
                  }
                >
                  Ask for confirmation before triggering a rebuild
                </Checkbox>
              </Flex>

              <Flex gap={2} paddingTop={5} justifyContent="flex-end">
                <Button variant="tertiary" onClick={handleSettingsReset} disabled={settingsSaving}>
                  Reset to defaults
                </Button>
                <Button onClick={handleSettingsSave} loading={settingsSaving}>
                  Save settings
                </Button>
              </Flex>
            </Box>
          </Box>
        )}

        <Divider />

        <Box paddingTop={6}>
          <Typography variant="delta" tag="h3">
            Recent builds
          </Typography>
          <Box paddingTop={2} paddingBottom={4}>
            <Typography variant="pi" textColor="neutral600">
              Last {history.length} pipeline{history.length === 1 ? "" : "s"}. Updated live via GitLab webhook.
            </Typography>
          </Box>

          {pendingTrigger && (
            <PendingPipelineRow
              message={pendingTrigger.message}
              provider={pendingProvider}
            />
          )}

          {history.length === 0 && !pendingTrigger ? (
            <Box padding={6} background="neutral0" hasRadius>
              <Typography variant="omega" textColor="neutral600">
                No builds yet. Trigger a rebuild or wait for the next GitLab pipeline event.
              </Typography>
            </Box>
          ) : (
            history.map((p) => <PipelineRow key={p.id || p.sha || Math.random()} pipeline={p} />)
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default HomePage;
