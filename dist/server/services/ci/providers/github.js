"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.githubProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const utils_1 = require("../utils");
const readGitHubConfig = () => ({
    apiBaseUrl: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_API_BASE_URL) || 'https://api.github.com',
    owner: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_OWNER),
    repo: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_REPO),
    workflowId: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_WORKFLOW_ID),
    ref: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_REF) || 'main',
    token: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_TOKEN),
    webhookSecret: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_WEBHOOK_SECRET),
});
const getGitHubCommitUrl = (repositoryUrl, sha) => {
    if (!repositoryUrl || !sha)
        return null;
    return `${repositoryUrl.replace(/\/$/, '')}/commit/${sha}`;
};
const buildGitHubTriggerer = (sender) => {
    var _a, _b, _c;
    return ({
        name: (_a = sender === null || sender === void 0 ? void 0 : sender.login) !== null && _a !== void 0 ? _a : null,
        username: (_b = sender === null || sender === void 0 ? void 0 : sender.login) !== null && _b !== void 0 ? _b : null,
        avatar_url: (_c = sender === null || sender === void 0 ? void 0 : sender.avatar_url) !== null && _c !== void 0 ? _c : null,
    });
};
const buildGitHubTriggerMessage = (runId, lastTrigger) => {
    var _a;
    if ((lastTrigger === null || lastTrigger === void 0 ? void 0 : lastTrigger.provider) === 'github' &&
        (lastTrigger === null || lastTrigger === void 0 ? void 0 : lastTrigger.pipelineId) != null &&
        runId != null &&
        String(lastTrigger.pipelineId) === String(runId)) {
        return (_a = lastTrigger.message) !== null && _a !== void 0 ? _a : null;
    }
    return null;
};
const normalizeGitHubRun = (payload, lastTrigger) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    const run = (payload === null || payload === void 0 ? void 0 : payload.workflow_run) || {};
    const workflow = (payload === null || payload === void 0 ? void 0 : payload.workflow) || {};
    const repository = (payload === null || payload === void 0 ? void 0 : payload.repository) || {};
    const sender = (payload === null || payload === void 0 ? void 0 : payload.sender) || {};
    const commitMessage = (_b = (_a = run === null || run === void 0 ? void 0 : run.head_commit) === null || _a === void 0 ? void 0 : _a.message) !== null && _b !== void 0 ? _b : null;
    const commitTitle = (0, utils_1.getFirstNonEmptyLine)(commitMessage) || (run === null || run === void 0 ? void 0 : run.display_title) || null;
    const finishedAt = (run === null || run === void 0 ? void 0 : run.status) === 'completed' ? (_c = run === null || run === void 0 ? void 0 : run.updated_at) !== null && _c !== void 0 ? _c : null : null;
    const startedAt = (_e = (_d = run === null || run === void 0 ? void 0 : run.run_started_at) !== null && _d !== void 0 ? _d : run === null || run === void 0 ? void 0 : run.created_at) !== null && _e !== void 0 ? _e : null;
    return {
        provider: 'github',
        id: (_f = run === null || run === void 0 ? void 0 : run.id) !== null && _f !== void 0 ? _f : null,
        iid: (_g = run === null || run === void 0 ? void 0 : run.run_number) !== null && _g !== void 0 ? _g : null,
        name: (_j = (_h = run === null || run === void 0 ? void 0 : run.name) !== null && _h !== void 0 ? _h : workflow === null || workflow === void 0 ? void 0 : workflow.name) !== null && _j !== void 0 ? _j : null,
        status: (0, utils_1.mapGitHubStatus)(run === null || run === void 0 ? void 0 : run.status, run === null || run === void 0 ? void 0 : run.conclusion),
        detailed_status: [run === null || run === void 0 ? void 0 : run.status, (0, utils_1.formatGitHubConclusion)(run === null || run === void 0 ? void 0 : run.conclusion)].filter(Boolean).join(': ') || null,
        ref: (_k = run === null || run === void 0 ? void 0 : run.head_branch) !== null && _k !== void 0 ? _k : null,
        sha: (_l = run === null || run === void 0 ? void 0 : run.head_sha) !== null && _l !== void 0 ? _l : null,
        source: (_m = run === null || run === void 0 ? void 0 : run.event) !== null && _m !== void 0 ? _m : 'workflow_dispatch',
        stages: [],
        created_at: (_o = run === null || run === void 0 ? void 0 : run.created_at) !== null && _o !== void 0 ? _o : null,
        finished_at: finishedAt,
        duration: (0, utils_1.diffSeconds)(startedAt, finishedAt),
        url: (_p = run === null || run === void 0 ? void 0 : run.html_url) !== null && _p !== void 0 ? _p : null,
        commit: {
            id: (_q = run === null || run === void 0 ? void 0 : run.head_sha) !== null && _q !== void 0 ? _q : null,
            title: commitTitle,
            message: commitMessage,
            url: getGitHubCommitUrl((_r = repository === null || repository === void 0 ? void 0 : repository.html_url) !== null && _r !== void 0 ? _r : null, (_s = run === null || run === void 0 ? void 0 : run.head_sha) !== null && _s !== void 0 ? _s : null),
        },
        triggerer: buildGitHubTriggerer(sender),
        trigger_message: buildGitHubTriggerMessage((_t = run === null || run === void 0 ? void 0 : run.id) !== null && _t !== void 0 ? _t : null, lastTrigger),
        builds: [],
        updated_at: new Date().toISOString(),
    };
};
const normalizeGitHubJob = (payload, lastTrigger) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    const job = (payload === null || payload === void 0 ? void 0 : payload.workflow_job) || {};
    const workflowRun = (payload === null || payload === void 0 ? void 0 : payload.workflow_run) || {};
    const repository = (payload === null || payload === void 0 ? void 0 : payload.repository) || {};
    const sender = (payload === null || payload === void 0 ? void 0 : payload.sender) || {};
    const build = {
        id: (_a = job === null || job === void 0 ? void 0 : job.id) !== null && _a !== void 0 ? _a : null,
        stage: (_b = job === null || job === void 0 ? void 0 : job.name) !== null && _b !== void 0 ? _b : null,
        name: (_c = job === null || job === void 0 ? void 0 : job.name) !== null && _c !== void 0 ? _c : null,
        status: (0, utils_1.mapGitHubStatus)(job === null || job === void 0 ? void 0 : job.status, job === null || job === void 0 ? void 0 : job.conclusion),
        started_at: (_d = job === null || job === void 0 ? void 0 : job.started_at) !== null && _d !== void 0 ? _d : null,
        finished_at: (_e = job === null || job === void 0 ? void 0 : job.completed_at) !== null && _e !== void 0 ? _e : null,
        duration: (0, utils_1.diffSeconds)((_f = job === null || job === void 0 ? void 0 : job.started_at) !== null && _f !== void 0 ? _f : null, (_g = job === null || job === void 0 ? void 0 : job.completed_at) !== null && _g !== void 0 ? _g : null),
        failure_reason: (0, utils_1.formatGitHubConclusion)(job === null || job === void 0 ? void 0 : job.conclusion),
    };
    const runId = (_j = (_h = job === null || job === void 0 ? void 0 : job.run_id) !== null && _h !== void 0 ? _h : workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.id) !== null && _j !== void 0 ? _j : null;
    return {
        provider: 'github',
        id: runId,
        iid: (_k = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.run_number) !== null && _k !== void 0 ? _k : null,
        name: (_m = (_l = job === null || job === void 0 ? void 0 : job.workflow_name) !== null && _l !== void 0 ? _l : workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.name) !== null && _m !== void 0 ? _m : null,
        status: (0, utils_1.mapGitHubStatus)(job === null || job === void 0 ? void 0 : job.status, job === null || job === void 0 ? void 0 : job.conclusion),
        detailed_status: [job === null || job === void 0 ? void 0 : job.status, (0, utils_1.formatGitHubConclusion)(job === null || job === void 0 ? void 0 : job.conclusion)].filter(Boolean).join(': ') || null,
        ref: (_o = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.head_branch) !== null && _o !== void 0 ? _o : null,
        sha: (_p = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.head_sha) !== null && _p !== void 0 ? _p : null,
        source: (_q = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.event) !== null && _q !== void 0 ? _q : 'workflow_dispatch',
        stages: (0, utils_1.deriveStages)([job === null || job === void 0 ? void 0 : job.name].filter(Boolean), [build]),
        created_at: (_r = job === null || job === void 0 ? void 0 : job.started_at) !== null && _r !== void 0 ? _r : null,
        finished_at: (job === null || job === void 0 ? void 0 : job.status) === 'completed' ? (_s = job === null || job === void 0 ? void 0 : job.completed_at) !== null && _s !== void 0 ? _s : null : null,
        duration: (0, utils_1.diffSeconds)((_t = job === null || job === void 0 ? void 0 : job.started_at) !== null && _t !== void 0 ? _t : null, (_u = job === null || job === void 0 ? void 0 : job.completed_at) !== null && _u !== void 0 ? _u : null),
        url: (_v = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.html_url) !== null && _v !== void 0 ? _v : null,
        commit: {
            id: (_w = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.head_sha) !== null && _w !== void 0 ? _w : null,
            title: (_x = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.display_title) !== null && _x !== void 0 ? _x : null,
            message: (_z = (_y = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.head_commit) === null || _y === void 0 ? void 0 : _y.message) !== null && _z !== void 0 ? _z : null,
            url: getGitHubCommitUrl((_0 = repository === null || repository === void 0 ? void 0 : repository.html_url) !== null && _0 !== void 0 ? _0 : null, (_1 = workflowRun === null || workflowRun === void 0 ? void 0 : workflowRun.head_sha) !== null && _1 !== void 0 ? _1 : null),
        },
        triggerer: buildGitHubTriggerer(sender),
        trigger_message: buildGitHubTriggerMessage(runId, lastTrigger),
        builds: [build],
        updated_at: new Date().toISOString(),
    };
};
const safeCompareSignatures = (expected, received) => {
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    if (expectedBuffer.length !== receivedBuffer.length)
        return false;
    return crypto_1.default.timingSafeEqual(expectedBuffer, receivedBuffer);
};
const getRawBodyBuffer = (rawBody) => {
    if (!rawBody)
        return null;
    return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
};
exports.githubProvider = {
    name: 'github',
    async triggerPipeline({ message, triggeredBy }) {
        var _a, _b;
        const config = readGitHubConfig();
        if (!config.owner || !config.repo || !config.workflowId || !config.token) {
            throw (0, utils_1.buildHttpError)(500, 'GitHub provider is misconfigured: missing owner, repo, workflow ID, or token.', {
                hasOwner: !!config.owner,
                hasRepo: !!config.repo,
                hasWorkflowId: !!config.workflowId,
                hasToken: !!config.token,
            });
        }
        const trimmedMessage = (0, utils_1.trimToNull)(message, 500);
        const trimmedBy = (0, utils_1.trimToNull)(triggeredBy, 200);
        const inputs = {};
        if (trimmedMessage)
            inputs.build_message = trimmedMessage;
        if (trimmedBy)
            inputs.triggered_by = trimmedBy;
        const { data } = await axios_1.default.post(`${config.apiBaseUrl.replace(/\/$/, '')}/repos/${config.owner}/${config.repo}/actions/workflows/${encodeURIComponent(config.workflowId)}/dispatches`, {
            ref: config.ref,
            inputs,
        }, {
            params: {
                return_run_details: true,
            },
            headers: {
                Accept: 'application/vnd.github+json',
                Authorization: `Bearer ${config.token}`,
            },
        });
        return {
            provider: 'github',
            pipelineId: (_a = data === null || data === void 0 ? void 0 : data.workflow_run_id) !== null && _a !== void 0 ? _a : null,
            pipelineUrl: (_b = data === null || data === void 0 ? void 0 : data.html_url) !== null && _b !== void 0 ? _b : null,
            raw: data !== null && data !== void 0 ? data : null,
        };
    },
    async handleWebhook({ headers, payload, rawBody, lastTrigger }) {
        const config = readGitHubConfig();
        if (!config.webhookSecret) {
            throw (0, utils_1.buildHttpError)(500, 'GitHub webhook secret is not configured.');
        }
        const signature = (0, utils_1.getHeader)(headers, 'x-hub-signature-256');
        if (!signature) {
            throw (0, utils_1.buildHttpError)(401, 'Missing GitHub webhook signature.');
        }
        const rawBodyBuffer = getRawBodyBuffer(rawBody);
        if (!rawBodyBuffer) {
            throw (0, utils_1.buildHttpError)(500, 'GitHub webhook verification requires access to the raw request body. Enable `includeUnparsed: true` in Strapi body middleware.');
        }
        const expectedSignature = `sha256=${crypto_1.default
            .createHmac('sha256', config.webhookSecret)
            .update(rawBodyBuffer)
            .digest('hex')}`;
        if (!safeCompareSignatures(expectedSignature, signature)) {
            throw (0, utils_1.buildHttpError)(401, 'Invalid GitHub webhook signature.');
        }
        const event = (0, utils_1.getHeader)(headers, 'x-github-event');
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
