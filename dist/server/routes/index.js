"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    admin: {
        type: 'admin',
        routes: [
            {
                method: 'GET',
                path: '/pipeline-status',
                handler: 'myController.pipelineStatus',
                config: {
                    policies: [],
                },
            },
            {
                method: 'POST',
                path: '/trigger-pipeline',
                handler: 'myController.triggerPipeline',
                config: {
                    policies: [],
                },
            },
            {
                method: 'GET',
                path: '/settings',
                handler: 'myController.getSettings',
                config: {
                    policies: [],
                },
            },
            {
                method: 'PUT',
                path: '/settings',
                handler: 'myController.updateSettings',
                config: {
                    policies: [],
                },
            },
            {
                method: 'GET',
                path: '/readme',
                handler: 'myController.getReadme',
                config: {
                    policies: [],
                },
            },
        ],
    },
    'content-api': {
        type: 'content-api',
        routes: [
            {
                method: 'POST',
                path: '/webhook',
                handler: 'myController.webhook',
                config: {
                    auth: false,
                    policies: [],
                },
            },
        ],
    },
};
