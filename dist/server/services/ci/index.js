"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProvider = exports.detectWebhookProviderName = exports.getConfiguredProviderName = void 0;
const github_1 = require("./providers/github");
const gitlab_1 = require("./providers/gitlab");
const utils_1 = require("./utils");
const providers = {
    gitlab: gitlab_1.gitlabProvider,
    github: github_1.githubProvider,
};
const getConfiguredProviderName = () => {
    var _a;
    const configured = (_a = (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_PROVIDER)) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (configured === 'github')
        return 'github';
    return 'gitlab';
};
exports.getConfiguredProviderName = getConfiguredProviderName;
const detectWebhookProviderName = (headers) => {
    if ((0, utils_1.getHeader)(headers, 'x-github-event'))
        return 'github';
    if ((0, utils_1.getHeader)(headers, 'x-gitlab-event'))
        return 'gitlab';
    return null;
};
exports.detectWebhookProviderName = detectWebhookProviderName;
const getProvider = (providerName) => providers[providerName];
exports.getProvider = getProvider;
