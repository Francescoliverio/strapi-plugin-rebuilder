"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatGitHubConclusion = exports.mapGitHubStatus = exports.mergePipeline = exports.attachTriggerMetadata = exports.isSamePipeline = exports.deriveStages = exports.mergeBuilds = exports.diffSeconds = exports.getFirstNonEmptyLine = exports.trimToNull = exports.getHeader = exports.buildHttpError = void 0;
const buildHttpError = (status, message, details) => {
    const error = new Error(message);
    error.status = status;
    error.details = details;
    return error;
};
exports.buildHttpError = buildHttpError;
const getHeader = (headers, name) => {
    var _a, _b;
    const value = (_b = (_a = headers === null || headers === void 0 ? void 0 : headers[name]) !== null && _a !== void 0 ? _a : headers === null || headers === void 0 ? void 0 : headers[name.toLowerCase()]) !== null && _b !== void 0 ? _b : headers === null || headers === void 0 ? void 0 : headers[name.toUpperCase()];
    if (Array.isArray(value))
        return value[0];
    if (typeof value === 'string')
        return value;
    return undefined;
};
exports.getHeader = getHeader;
const trimToNull = (value, maxLength) => {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    return typeof maxLength === 'number' ? trimmed.slice(0, maxLength) : trimmed;
};
exports.trimToNull = trimToNull;
const getFirstNonEmptyLine = (value) => {
    if (!value)
        return null;
    return (value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) || null);
};
exports.getFirstNonEmptyLine = getFirstNonEmptyLine;
const diffSeconds = (start, end) => {
    if (!start || !end)
        return null;
    const startMs = new Date(start).getTime();
    const endMs = new Date(end).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs)
        return null;
    return (endMs - startMs) / 1000;
};
exports.diffSeconds = diffSeconds;
const buildKey = (build) => build.id != null ? `id:${String(build.id)}` : `stage:${build.stage || ''}|name:${build.name || ''}`;
const mergeBuilds = (existingBuilds = [], incomingBuilds = []) => {
    const merged = new Map();
    [...existingBuilds, ...incomingBuilds].forEach((build) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
        const key = buildKey(build);
        const previous = merged.get(key);
        merged.set(key, {
            ...(previous || {}),
            ...build,
            id: (_b = (_a = build.id) !== null && _a !== void 0 ? _a : previous === null || previous === void 0 ? void 0 : previous.id) !== null && _b !== void 0 ? _b : null,
            stage: (_d = (_c = build.stage) !== null && _c !== void 0 ? _c : previous === null || previous === void 0 ? void 0 : previous.stage) !== null && _d !== void 0 ? _d : null,
            name: (_f = (_e = build.name) !== null && _e !== void 0 ? _e : previous === null || previous === void 0 ? void 0 : previous.name) !== null && _f !== void 0 ? _f : null,
            status: (_h = (_g = build.status) !== null && _g !== void 0 ? _g : previous === null || previous === void 0 ? void 0 : previous.status) !== null && _h !== void 0 ? _h : 'unknown',
            started_at: (_k = (_j = build.started_at) !== null && _j !== void 0 ? _j : previous === null || previous === void 0 ? void 0 : previous.started_at) !== null && _k !== void 0 ? _k : null,
            finished_at: (_m = (_l = build.finished_at) !== null && _l !== void 0 ? _l : previous === null || previous === void 0 ? void 0 : previous.finished_at) !== null && _m !== void 0 ? _m : null,
            duration: (_p = (_o = build.duration) !== null && _o !== void 0 ? _o : previous === null || previous === void 0 ? void 0 : previous.duration) !== null && _p !== void 0 ? _p : null,
            failure_reason: (_r = (_q = build.failure_reason) !== null && _q !== void 0 ? _q : previous === null || previous === void 0 ? void 0 : previous.failure_reason) !== null && _r !== void 0 ? _r : null,
        });
    });
    return Array.from(merged.values());
};
exports.mergeBuilds = mergeBuilds;
const deriveStages = (preferredStages = [], builds = [], fallbackStages = []) => {
    const stages = new Set();
    [...preferredStages, ...fallbackStages].forEach((stage) => {
        if (stage)
            stages.add(stage);
    });
    builds.forEach((build) => {
        if (build.stage)
            stages.add(build.stage);
    });
    return Array.from(stages);
};
exports.deriveStages = deriveStages;
const isSamePipeline = (pipeline, provider, pipelineId) => {
    if (!pipeline || pipelineId == null)
        return false;
    return pipeline.provider === provider && String(pipeline.id) === String(pipelineId);
};
exports.isSamePipeline = isSamePipeline;
const mergeCommit = (existingCommit, incomingCommit) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    return ({
        id: (_b = (_a = incomingCommit.id) !== null && _a !== void 0 ? _a : existingCommit === null || existingCommit === void 0 ? void 0 : existingCommit.id) !== null && _b !== void 0 ? _b : null,
        title: (_d = (_c = incomingCommit.title) !== null && _c !== void 0 ? _c : existingCommit === null || existingCommit === void 0 ? void 0 : existingCommit.title) !== null && _d !== void 0 ? _d : null,
        message: (_f = (_e = incomingCommit.message) !== null && _e !== void 0 ? _e : existingCommit === null || existingCommit === void 0 ? void 0 : existingCommit.message) !== null && _f !== void 0 ? _f : null,
        url: (_h = (_g = incomingCommit.url) !== null && _g !== void 0 ? _g : existingCommit === null || existingCommit === void 0 ? void 0 : existingCommit.url) !== null && _h !== void 0 ? _h : null,
    });
};
const mergeTriggerer = (existingTriggerer, incomingTriggerer) => {
    var _a, _b, _c, _d, _e, _f;
    return ({
        name: (_b = (_a = incomingTriggerer.name) !== null && _a !== void 0 ? _a : existingTriggerer === null || existingTriggerer === void 0 ? void 0 : existingTriggerer.name) !== null && _b !== void 0 ? _b : null,
        username: (_d = (_c = incomingTriggerer.username) !== null && _c !== void 0 ? _c : existingTriggerer === null || existingTriggerer === void 0 ? void 0 : existingTriggerer.username) !== null && _d !== void 0 ? _d : null,
        avatar_url: (_f = (_e = incomingTriggerer.avatar_url) !== null && _e !== void 0 ? _e : existingTriggerer === null || existingTriggerer === void 0 ? void 0 : existingTriggerer.avatar_url) !== null && _f !== void 0 ? _f : null,
    });
};
const attachTriggerMetadata = (pipeline, lastTrigger) => {
    var _a, _b, _c, _d;
    if (!lastTrigger)
        return pipeline;
    const exactMatch = (0, exports.isSamePipeline)(pipeline, lastTrigger.provider, lastTrigger.pipelineId);
    const timestampMatch = !exactMatch &&
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
        trigger_message: (_b = (_a = pipeline.trigger_message) !== null && _a !== void 0 ? _a : lastTrigger.message) !== null && _b !== void 0 ? _b : null,
        url: (_d = (_c = pipeline.url) !== null && _c !== void 0 ? _c : lastTrigger.pipelineUrl) !== null && _d !== void 0 ? _d : null,
    };
};
exports.attachTriggerMetadata = attachTriggerMetadata;
const mergePipeline = (existingPipeline, incomingPipeline, lastTrigger) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    const mergedBuilds = (0, exports.mergeBuilds)(existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.builds, incomingPipeline.builds);
    const mergedPipeline = {
        ...(existingPipeline || incomingPipeline),
        ...incomingPipeline,
        provider: incomingPipeline.provider,
        id: (_b = (_a = incomingPipeline.id) !== null && _a !== void 0 ? _a : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.id) !== null && _b !== void 0 ? _b : null,
        iid: (_d = (_c = incomingPipeline.iid) !== null && _c !== void 0 ? _c : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.iid) !== null && _d !== void 0 ? _d : null,
        name: (_f = (_e = incomingPipeline.name) !== null && _e !== void 0 ? _e : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.name) !== null && _f !== void 0 ? _f : null,
        status: (_h = (_g = incomingPipeline.status) !== null && _g !== void 0 ? _g : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.status) !== null && _h !== void 0 ? _h : 'unknown',
        detailed_status: (_k = (_j = incomingPipeline.detailed_status) !== null && _j !== void 0 ? _j : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.detailed_status) !== null && _k !== void 0 ? _k : null,
        ref: (_m = (_l = incomingPipeline.ref) !== null && _l !== void 0 ? _l : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.ref) !== null && _m !== void 0 ? _m : null,
        sha: (_p = (_o = incomingPipeline.sha) !== null && _o !== void 0 ? _o : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.sha) !== null && _p !== void 0 ? _p : null,
        source: (_r = (_q = incomingPipeline.source) !== null && _q !== void 0 ? _q : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.source) !== null && _r !== void 0 ? _r : null,
        created_at: (_t = (_s = incomingPipeline.created_at) !== null && _s !== void 0 ? _s : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.created_at) !== null && _t !== void 0 ? _t : null,
        finished_at: (_v = (_u = incomingPipeline.finished_at) !== null && _u !== void 0 ? _u : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.finished_at) !== null && _v !== void 0 ? _v : null,
        duration: (_x = (_w = incomingPipeline.duration) !== null && _w !== void 0 ? _w : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.duration) !== null && _x !== void 0 ? _x : null,
        url: (_z = (_y = incomingPipeline.url) !== null && _y !== void 0 ? _y : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.url) !== null && _z !== void 0 ? _z : null,
        commit: mergeCommit(existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.commit, incomingPipeline.commit),
        triggerer: mergeTriggerer(existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.triggerer, incomingPipeline.triggerer),
        trigger_message: (_1 = (_0 = incomingPipeline.trigger_message) !== null && _0 !== void 0 ? _0 : existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.trigger_message) !== null && _1 !== void 0 ? _1 : null,
        builds: mergedBuilds,
        updated_at: incomingPipeline.updated_at || new Date().toISOString(),
        stages: (0, exports.deriveStages)(incomingPipeline.stages, mergedBuilds, existingPipeline === null || existingPipeline === void 0 ? void 0 : existingPipeline.stages),
    };
    return (0, exports.attachTriggerMetadata)(mergedPipeline, lastTrigger);
};
exports.mergePipeline = mergePipeline;
const mapGitHubStatus = (status, conclusion) => {
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
exports.mapGitHubStatus = mapGitHubStatus;
const formatGitHubConclusion = (conclusion) => {
    if (!conclusion)
        return null;
    return conclusion.replace(/_/g, ' ');
};
exports.formatGitHubConclusion = formatGitHubConclusion;
