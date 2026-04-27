"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ strapi }) => ({
    async pipelineStatus(ctx) {
        try {
            const data = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .getPipelineStatus();
            ctx.body = data;
        }
        catch (error) {
            ctx.status = 500;
            ctx.body = { error: error.message };
        }
    },
    async triggerPipeline(ctx) {
        var _a, _b, _c, _d;
        const { message } = (ctx.request.body || {});
        const adminUser = (_a = ctx.state) === null || _a === void 0 ? void 0 : _a.user;
        const triggeredBy = adminUser
            ? [adminUser.firstname, adminUser.lastname].filter(Boolean).join(' ').trim() ||
                adminUser.email ||
                adminUser.username
            : undefined;
        try {
            const data = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .triggerPipeline({ message, triggeredBy });
            ctx.body = data;
        }
        catch (error) {
            const status = (error === null || error === void 0 ? void 0 : error.status) || ((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.status) || 500;
            const providerBody = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data;
            strapi.log.error('[nexjs-rebuilder] CI trigger failed', {
                status,
                providerBody,
                url: (_d = error === null || error === void 0 ? void 0 : error.config) === null || _d === void 0 ? void 0 : _d.url,
                details: error === null || error === void 0 ? void 0 : error.details,
            });
            ctx.status = status;
            ctx.body = {
                error: (providerBody === null || providerBody === void 0 ? void 0 : providerBody.message) || (providerBody === null || providerBody === void 0 ? void 0 : providerBody.error) || error.message,
                providerResponse: providerBody,
                details: error === null || error === void 0 ? void 0 : error.details,
            };
        }
    },
    async getSettings(ctx) {
        try {
            const data = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .getSettings();
            ctx.body = data;
        }
        catch (error) {
            ctx.status = 500;
            ctx.body = { error: error.message };
        }
    },
    async updateSettings(ctx) {
        try {
            const input = (ctx.request.body || {});
            const data = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .updateSettings(input);
            ctx.body = data;
        }
        catch (error) {
            ctx.status = (error === null || error === void 0 ? void 0 : error.status) || 500;
            ctx.body = { error: error.message };
        }
    },
    async getReadme(ctx) {
        var _a;
        try {
            const themeParam = String((((_a = ctx.query) === null || _a === void 0 ? void 0 : _a.theme) || '')).toLowerCase();
            const theme = themeParam === 'dark' ? 'dark' : 'light';
            const data = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .getReadme({ theme });
            ctx.body = data;
        }
        catch (error) {
            ctx.status = (error === null || error === void 0 ? void 0 : error.status) || 500;
            ctx.body = { error: error.message };
        }
    },
    async webhook(ctx) {
        var _a;
        try {
            const unparsedBody = ((_a = ctx.request.body) === null || _a === void 0 ? void 0 : _a[Symbol.for('unparsedBody')]) || ctx.request.rawBody;
            const result = await strapi
                .plugin('nexjs-rebuilder')
                .service('myService')
                .handleWebhook({
                headers: ctx.request.header,
                payload: ctx.request.body,
                rawBody: unparsedBody,
            });
            ctx.body = result;
        }
        catch (error) {
            strapi.log.error('[nexjs-rebuilder] Failed to handle webhook:', error);
            ctx.status = (error === null || error === void 0 ? void 0 : error.status) || 500;
            ctx.body = { error: error.message, details: error === null || error === void 0 ? void 0 : error.details };
        }
    },
});
