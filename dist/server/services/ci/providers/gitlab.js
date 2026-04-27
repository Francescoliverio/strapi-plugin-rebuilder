"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitlabProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const utils_1 = require("../utils");
const readGitLabConfig = () => ({
    apiBaseUrl: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_API_BASE_URL) || 'https://gitlab.com/api/v4',
    projectId: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_PROJECT_ID) ||
        (0, utils_1.trimToNull)(process.env.STRAPI_ADMIN_GITLAB_PROJECT_ID),
    triggerToken: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_TRIGGER_TOKEN) ||
        (0, utils_1.trimToNull)(process.env.STRAPI_ADMIN_GITLAB_PIPELINE_TRIGGER_TOKEN),
    webhookSecret: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_WEBHOOK_SECRET) ||
        (0, utils_1.trimToNull)(process.env.STRAPI_GITLAB_WEBHOOK_SECRET),
    ref: (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_REF) || 'main',
});
const pickBuild = (build) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return ({
        id: (_a = build === null || build === void 0 ? void 0 : build.id) !== null && _a !== void 0 ? _a : null,
        stage: (_b = build === null || build === void 0 ? void 0 : build.stage) !== null && _b !== void 0 ? _b : null,
        name: (_c = build === null || build === void 0 ? void 0 : build.name) !== null && _c !== void 0 ? _c : null,
        status: (_d = build === null || build === void 0 ? void 0 : build.status) !== null && _d !== void 0 ? _d : null,
        started_at: (_e = build === null || build === void 0 ? void 0 : build.started_at) !== null && _e !== void 0 ? _e : null,
        finished_at: (_f = build === null || build === void 0 ? void 0 : build.finished_at) !== null && _f !== void 0 ? _f : null,
        duration: (_g = build === null || build === void 0 ? void 0 : build.duration) !== null && _g !== void 0 ? _g : null,
        failure_reason: (_h = build === null || build === void 0 ? void 0 : build.failure_reason) !== null && _h !== void 0 ? _h : null,
    });
};
const normalizeGitLabPipeline = (payload, lastTrigger) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
    const attrs = (payload === null || payload === void 0 ? void 0 : payload.object_attributes) || {};
    const commit = (payload === null || payload === void 0 ? void 0 : payload.commit) || {};
    const user = (payload === null || payload === void 0 ? void 0 : payload.user) || {};
    const builds = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.builds) ? payload.builds.map(pickBuild) : [];
    const pipelineId = (_a = attrs.id) !== null && _a !== void 0 ? _a : null;
    const triggerMessage = (lastTrigger === null || lastTrigger === void 0 ? void 0 : lastTrigger.provider) === 'gitlab' && (lastTrigger === null || lastTrigger === void 0 ? void 0 : lastTrigger.pipelineId) != null && String(lastTrigger.pipelineId) === String(pipelineId)
        ? (_b = lastTrigger === null || lastTrigger === void 0 ? void 0 : lastTrigger.message) !== null && _b !== void 0 ? _b : null
        : null;
    return {
        provider: 'gitlab',
        id: pipelineId,
        iid: (_c = attrs.iid) !== null && _c !== void 0 ? _c : null,
        name: (_d = attrs.name) !== null && _d !== void 0 ? _d : null,
        status: (_e = attrs.status) !== null && _e !== void 0 ? _e : 'unknown',
        detailed_status: (_f = attrs.detailed_status) !== null && _f !== void 0 ? _f : null,
        ref: (_g = attrs.ref) !== null && _g !== void 0 ? _g : null,
        sha: (_h = attrs.sha) !== null && _h !== void 0 ? _h : null,
        source: (_j = attrs.source) !== null && _j !== void 0 ? _j : null,
        stages: (0, utils_1.deriveStages)(Array.isArray(attrs.stages) ? attrs.stages : [], builds),
        created_at: (_k = attrs.created_at) !== null && _k !== void 0 ? _k : null,
        finished_at: (_l = attrs.finished_at) !== null && _l !== void 0 ? _l : null,
        duration: (_m = attrs.duration) !== null && _m !== void 0 ? _m : null,
        url: (_o = attrs.url) !== null && _o !== void 0 ? _o : null,
        commit: {
            id: (_p = commit.id) !== null && _p !== void 0 ? _p : null,
            title: (_q = commit.title) !== null && _q !== void 0 ? _q : null,
            message: (_r = commit.message) !== null && _r !== void 0 ? _r : null,
            url: (_s = commit.url) !== null && _s !== void 0 ? _s : null,
        },
        triggerer: {
            name: (_t = user.name) !== null && _t !== void 0 ? _t : null,
            username: (_u = user.username) !== null && _u !== void 0 ? _u : null,
            avatar_url: (_v = user.avatar_url) !== null && _v !== void 0 ? _v : null,
        },
        trigger_message: triggerMessage,
        builds,
        updated_at: new Date().toISOString(),
    };
};
exports.gitlabProvider = {
    name: 'gitlab',
    async triggerPipeline({ message, triggeredBy }) {
        var _a, _b;
        const config = readGitLabConfig();
        if (!config.projectId || !config.triggerToken) {
            throw (0, utils_1.buildHttpError)(500, 'GitLab provider is misconfigured: missing project ID or trigger token.', {
                hasProjectId: !!config.projectId,
                hasTriggerToken: !!config.triggerToken,
            });
        }
        const trimmedMessage = (0, utils_1.trimToNull)(message, 500);
        const trimmedBy = (0, utils_1.trimToNull)(triggeredBy, 200);
        const params = new URLSearchParams();
        params.append('token', config.triggerToken);
        params.append('ref', config.ref);
        if (trimmedMessage)
            params.append('variables[BUILD_MESSAGE]', trimmedMessage);
        if (trimmedBy)
            params.append('variables[TRIGGERED_BY]', trimmedBy);
        const { data } = await axios_1.default.post(`${config.apiBaseUrl.replace(/\/$/, '')}/projects/${config.projectId}/trigger/pipeline`, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        return {
            provider: 'gitlab',
            pipelineId: (_a = data === null || data === void 0 ? void 0 : data.id) !== null && _a !== void 0 ? _a : null,
            pipelineUrl: (_b = data === null || data === void 0 ? void 0 : data.web_url) !== null && _b !== void 0 ? _b : null,
            raw: data,
        };
    },
    async handleWebhook({ headers, payload, lastTrigger }) {
        const config = readGitLabConfig();
        if (!config.webhookSecret) {
            throw (0, utils_1.buildHttpError)(500, 'GitLab webhook secret is not configured.');
        }
        const receivedSecret = (0, utils_1.getHeader)(headers, 'x-gitlab-token');
        if (receivedSecret !== config.webhookSecret) {
            throw (0, utils_1.buildHttpError)(401, 'Invalid GitLab webhook secret.');
        }
        const event = (0, utils_1.getHeader)(headers, 'x-gitlab-event');
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
