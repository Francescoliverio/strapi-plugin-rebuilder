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
    if (configured === 'gitlab')
        return 'gitlab';
    if ((0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_TOKEN) || (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITHUB_OWNER))
        return 'github';
    if ((0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_TRIGGER_TOKEN) || (0, utils_1.trimToNull)(process.env.NEXJS_REBUILDER_GITLAB_PROJECT_ID) || (0, utils_1.trimToNull)(process.env.STRAPI_ADMIN_GITLAB_PROJECT_ID))
        return 'gitlab';
    throw (0, utils_1.buildHttpError)(500, 'No CI provider configured. Set NEXJS_REBUILDER_PROVIDER to "gitlab" or "github" and provide the required environment variables. See the plugin documentation for details.');
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
