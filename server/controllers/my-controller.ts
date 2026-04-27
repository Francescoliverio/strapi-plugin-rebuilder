import type { StrapiLifecycleContext } from '../types/strapi';

export default ({ strapi }: StrapiLifecycleContext) => ({
  async pipelineStatus(ctx) {
    try {
      const data = await strapi
        .plugin('nexjs-rebuilder')
        .service('myService')
        .getPipelineStatus();
      ctx.body = data;
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: error.message };
    }
  },

  async triggerPipeline(ctx) {
    const { message } = (ctx.request.body || {}) as { message?: string };
    const adminUser: any = ctx.state?.user;
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
    } catch (error) {
      const status = error?.status || error?.response?.status || 500;
      const providerBody = error?.response?.data;
      strapi.log.error('[nexjs-rebuilder] CI trigger failed', {
        status,
        providerBody,
        url: error?.config?.url,
        details: error?.details,
      });
      ctx.status = status;
      ctx.body = {
        error: providerBody?.message || providerBody?.error || error.message,
        providerResponse: providerBody,
        details: error?.details,
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
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: error.message };
    }
  },

  async updateSettings(ctx) {
    try {
      const input = (ctx.request.body || {}) as Record<string, unknown>;
      const data = await strapi
        .plugin('nexjs-rebuilder')
        .service('myService')
        .updateSettings(input);
      ctx.body = data;
    } catch (error) {
      ctx.status = error?.status || 500;
      ctx.body = { error: error.message };
    }
  },

  async getReadme(ctx) {
    try {
      const themeParam = String((ctx.query?.theme || '')).toLowerCase();
      const theme = themeParam === 'dark' ? 'dark' : 'light';
      const data = await strapi
        .plugin('nexjs-rebuilder')
        .service('myService')
        .getReadme({ theme });
      ctx.body = data;
    } catch (error) {
      ctx.status = error?.status || 500;
      ctx.body = { error: error.message };
    }
  },

  async webhook(ctx) {
    try {
      const unparsedBody = ctx.request.body?.[Symbol.for('unparsedBody')] || ctx.request.rawBody;
      const result = await strapi
        .plugin('nexjs-rebuilder')
        .service('myService')
        .handleWebhook({
          headers: ctx.request.header,
          payload: ctx.request.body,
          rawBody: unparsedBody,
        });
      ctx.body = result;
    } catch (error) {
      strapi.log.error('[nexjs-rebuilder] Failed to handle webhook:', error);
      ctx.status = error?.status || 500;
      ctx.body = { error: error.message, details: error?.details };
    }
  },
});
