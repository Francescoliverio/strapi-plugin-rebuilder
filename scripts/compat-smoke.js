const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

require("ts-node/register/transpile-only");

const pluginRoot = path.resolve(__dirname, "..");
const adminRoot = path.join(pluginRoot, "admin", "src");

const {
  detectWebhookProviderName,
  getConfiguredProviderName,
} = require(path.join(pluginRoot, "server", "services", "ci", "index.ts"));
const { gitlabProvider } = require(
  path.join(pluginRoot, "server", "services", "ci", "providers", "gitlab.ts")
);
const { githubProvider } = require(
  path.join(pluginRoot, "server", "services", "ci", "providers", "github.ts")
);
const createService = require(
  path.join(pluginRoot, "server", "services", "my-service.ts")
).default;

const tests = [];

const test = (name, fn) => {
  tests.push({ name, fn });
};

const withEnv = async (patch, fn) => {
  const previous = {};

  Object.keys(patch).forEach((key) => {
    previous[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : undefined;

    if (patch[key] == null) {
      delete process.env[key];
    } else {
      process.env[key] = String(patch[key]);
    }
  });

  try {
    return await fn();
  } finally {
    Object.keys(patch).forEach((key) => {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    });
  }
};

const walkFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return walkFiles(fullPath);
    }

    return fullPath;
  });
};

const signGitHubPayload = (rawBody, secret) =>
  `sha256=${crypto.createHmac("sha256", secret).update(Buffer.from(rawBody)).digest("hex")}`;

const createMemoryStore = (initial = {}) => {
  const values = new Map(Object.entries(initial));

  return {
    async get({ key }) {
      return values.get(key);
    },
    async set({ key, value }) {
      values.set(key, value);
      return value;
    },
  };
};

const createGitLabPipeline = (overrides = {}) => ({
  provider: "gitlab",
  id: 101,
  iid: 11,
  name: null,
  status: "running",
  detailed_status: "running",
  ref: "main",
  sha: "abc123",
  source: "trigger",
  stages: ["build_image"],
  created_at: "2026-04-24T09:00:00.000Z",
  finished_at: null,
  duration: null,
  url: "https://gitlab.example.com/pipelines/101",
  commit: {
    id: "abc123",
    title: "Pipeline title",
    message: "Pipeline title\n\nBody",
    url: "https://gitlab.example.com/commit/abc123",
  },
  triggerer: {
    name: "Francesco Oliverio",
    username: "francesco",
    avatar_url: "https://example.com/avatar.png",
  },
  trigger_message: null,
  builds: [
    {
      id: 1,
      stage: "build_image",
      name: "build_image",
      status: "running",
      started_at: "2026-04-24T09:00:01.000Z",
      finished_at: null,
      duration: null,
      failure_reason: null,
    },
  ],
  updated_at: "2026-04-24T09:00:05.000Z",
  ...overrides,
});

test("admin compatibility smoke checks pass", () => {
  const adminFiles = walkFiles(adminRoot).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
  const helperPluginHits = [];
  const routerHits = [];

  adminFiles.forEach((file) => {
    const content = fs.readFileSync(file, "utf8");

    if (content.includes("@strapi/helper-plugin")) {
      helperPluginHits.push(path.relative(pluginRoot, file));
    }

    if (content.includes("react-router-dom")) {
      routerHits.push(path.relative(pluginRoot, file));
    }
  });

  assert.deepEqual(helperPluginHits, []);
  assert.deepEqual(routerHits, []);
  assert.equal(
    fs.existsSync(path.join(pluginRoot, "admin", "src", "webpack.config.ts")),
    false
  );
});

test("provider selection and webhook detection work", async () => {
  await withEnv({ NEXJS_REBUILDER_PROVIDER: null }, async () => {
    assert.equal(getConfiguredProviderName(), "gitlab");
  });

  await withEnv({ NEXJS_REBUILDER_PROVIDER: "github" }, async () => {
    assert.equal(getConfiguredProviderName(), "github");
  });

  assert.equal(detectWebhookProviderName({ "x-gitlab-event": "Pipeline Hook" }), "gitlab");
  assert.equal(detectWebhookProviderName({ "x-github-event": "workflow_run" }), "github");
  assert.equal(detectWebhookProviderName({}), null);
});

test("gitlab webhook payloads normalize correctly", async () => {
  await withEnv(
    {
      NEXJS_REBUILDER_GITLAB_WEBHOOK_SECRET: "gitlab-secret",
    },
    async () => {
      const result = await gitlabProvider.handleWebhook({
        headers: {
          "x-gitlab-token": "gitlab-secret",
          "x-gitlab-event": "Pipeline Hook",
        },
        payload: {
          object_attributes: {
            id: 873,
            iid: 873,
            name: "Release_11_47__24_04_2026",
            status: "running",
            detailed_status: "running",
            ref: "main",
            sha: "45c2fcc3",
            source: "trigger",
            stages: ["build_image", "restart_services"],
            created_at: "2026-04-24T09:47:40.000Z",
            finished_at: null,
            duration: null,
            url: "https://gitlab.com/example/project/-/pipelines/873",
          },
          commit: {
            id: "45c2fcc3",
            title: "Fix workflow:name variable fallback for pipeline list",
            message:
              "Fix workflow:name variable fallback for pipeline list\n\nDetailed body",
            url: "https://gitlab.com/example/project/-/commit/45c2fcc3",
          },
          user: {
            name: "Francesco Oliverio",
            username: "francescoliverio",
            avatar_url: "https://gitlab.com/uploads/avatar.png",
          },
          builds: [
            {
              id: 14074136407,
              stage: "build_image",
              name: "build_image",
              status: "running",
              started_at: "2026-04-24T09:47:43.000Z",
              finished_at: null,
              duration: 0.4,
              failure_reason: null,
            },
          ],
        },
        lastTrigger: {
          provider: "gitlab",
          message: "Release_11_47__24_04_2026",
          triggeredBy: "Frank Sinatra",
          pipelineId: 873,
          pipelineUrl: "https://gitlab.com/example/project/-/pipelines/873",
          at: "2026-04-24T09:47:40.000Z",
        },
      });

      assert.ok("pipeline" in result);
      assert.equal(result.pipeline.provider, "gitlab");
      assert.equal(result.pipeline.id, 873);
      assert.equal(result.pipeline.status, "running");
      assert.deepEqual(result.pipeline.stages, ["build_image", "restart_services"]);
      assert.equal(result.pipeline.trigger_message, "Release_11_47__24_04_2026");
      assert.equal(result.pipeline.builds.length, 1);

      const ignored = await gitlabProvider.handleWebhook({
        headers: {
          "x-gitlab-token": "gitlab-secret",
          "x-gitlab-event": "Push Hook",
        },
        payload: {},
      });

      assert.deepEqual(ignored, {
        ignored: true,
        reason: 'Event "Push Hook" not handled.',
      });
    }
  );
});

test("github workflow_run payloads normalize correctly", async () => {
  await withEnv(
    {
      NEXJS_REBUILDER_GITHUB_WEBHOOK_SECRET: "github-secret",
    },
    async () => {
      const payload = {
        workflow: { name: "Deploy Next.js" },
        workflow_run: {
          id: 501,
          run_number: 42,
          name: "Deploy production",
          status: "completed",
          conclusion: "success",
          head_branch: "main",
          head_sha: "deadbeef",
          event: "workflow_dispatch",
          created_at: "2026-04-24T10:00:00.000Z",
          updated_at: "2026-04-24T10:05:00.000Z",
          run_started_at: "2026-04-24T10:01:00.000Z",
          html_url: "https://github.com/acme/site/actions/runs/501",
          head_commit: {
            message: "Release_10_00__24_04_2026\n\nDeployed from Strapi",
          },
        },
        repository: {
          html_url: "https://github.com/acme/site",
        },
        sender: {
          login: "francescoliverio",
          avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
        },
      };
      const rawBody = JSON.stringify(payload);

      const result = await githubProvider.handleWebhook({
        headers: {
          "x-github-event": "workflow_run",
          "x-hub-signature-256": signGitHubPayload(rawBody, "github-secret"),
        },
        payload,
        rawBody,
        lastTrigger: {
          provider: "github",
          message: "Release_10_00__24_04_2026",
          triggeredBy: "Francesco Oliverio",
          pipelineId: 501,
          pipelineUrl: "https://github.com/acme/site/actions/runs/501",
          at: "2026-04-24T09:59:50.000Z",
        },
      });

      assert.ok("pipeline" in result);
      assert.equal(result.pipeline.provider, "github");
      assert.equal(result.pipeline.id, 501);
      assert.equal(result.pipeline.status, "success");
      assert.equal(result.pipeline.detailed_status, "completed: success");
      assert.equal(result.pipeline.commit.title, "Release_10_00__24_04_2026");
      assert.equal(result.pipeline.trigger_message, "Release_10_00__24_04_2026");
      assert.equal(result.pipeline.duration, 240);
    }
  );
});

test("github workflow_job payloads normalize correctly", async () => {
  await withEnv(
    {
      NEXJS_REBUILDER_GITHUB_WEBHOOK_SECRET: "github-secret",
    },
    async () => {
      const payload = {
        workflow_job: {
          id: 9001,
          run_id: 777,
          name: "deploy",
          workflow_name: "Deploy Next.js",
          status: "in_progress",
          conclusion: null,
          started_at: "2026-04-24T10:10:00.000Z",
          completed_at: null,
        },
        workflow_run: {
          id: 777,
          run_number: 88,
          name: "Deploy Next.js",
          display_title: "Release_10_10__24_04_2026",
          head_branch: "main",
          head_sha: "cafebabe",
          event: "workflow_dispatch",
          html_url: "https://github.com/acme/site/actions/runs/777",
          head_commit: {
            message: "Release_10_10__24_04_2026\n\nQueued from Strapi",
          },
        },
        repository: {
          html_url: "https://github.com/acme/site",
        },
        sender: {
          login: "octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
        },
      };
      const rawBody = JSON.stringify(payload);

      const result = await githubProvider.handleWebhook({
        headers: {
          "x-github-event": "workflow_job",
          "x-hub-signature-256": signGitHubPayload(rawBody, "github-secret"),
        },
        payload,
        rawBody,
      });

      assert.ok("pipeline" in result);
      assert.equal(result.pipeline.provider, "github");
      assert.equal(result.pipeline.id, 777);
      assert.equal(result.pipeline.status, "running");
      assert.deepEqual(result.pipeline.stages, ["deploy"]);
      assert.equal(result.pipeline.builds.length, 1);
      assert.equal(result.pipeline.builds[0].name, "deploy");
      assert.equal(result.pipeline.builds[0].status, "running");
    }
  );
});

test("service attaches github trigger metadata using timestamp fallback", async () => {
  await withEnv(
    {
      NEXJS_REBUILDER_GITHUB_WEBHOOK_SECRET: "github-secret",
      NEXJS_REBUILDER_PROVIDER: "github",
    },
    async () => {
      const store = createMemoryStore({
        "last-trigger-metadata": {
          provider: "github",
          message: "Release_10_20__24_04_2026",
          triggeredBy: "Francesco Oliverio",
          pipelineId: null,
          pipelineUrl: "https://github.com/acme/site/actions/runs/888",
          at: "2026-04-24T10:19:30.000Z",
        },
      });
      const service = createService({
        strapi: {
          store() {
            return store;
          },
        },
      });
      const payload = {
        workflow_run: {
          id: 888,
          run_number: 99,
          name: "Deploy Next.js",
          status: "queued",
          conclusion: null,
          head_branch: "main",
          head_sha: "feedface",
          event: "workflow_dispatch",
          created_at: "2026-04-24T10:20:00.000Z",
          updated_at: "2026-04-24T10:20:00.000Z",
          run_started_at: "2026-04-24T10:20:00.000Z",
          html_url: null,
          head_commit: {
            message: "Release_10_20__24_04_2026\n\nDispatch requested",
          },
        },
        repository: {
          html_url: "https://github.com/acme/site",
        },
        sender: {
          login: "octocat",
          avatar_url: "https://avatars.githubusercontent.com/u/2?v=4",
        },
      };
      const rawBody = JSON.stringify(payload);

      const result = await service.handleWebhook({
        headers: {
          "x-github-event": "workflow_run",
          "x-hub-signature-256": signGitHubPayload(rawBody, "github-secret"),
        },
        payload,
        rawBody,
      });

      assert.equal(result.ok, true);
      assert.equal(result.saved.trigger_message, "Release_10_20__24_04_2026");
      assert.equal(result.saved.url, "https://github.com/acme/site/actions/runs/888");

      const current = await service.getPipelineStatus();
      assert.equal(current.trigger_message, "Release_10_20__24_04_2026");
      assert.equal(current.history.length, 1);
      assert.equal(current.history[0].provider, "github");
    }
  );
});

test("service merges repeated pipeline updates into a single history entry", async () => {
  const store = createMemoryStore();
  const service = createService({
    strapi: {
      store() {
        return store;
      },
    },
  });

  await service.savePipelineStatus(
    createGitLabPipeline({
      status: "running",
      builds: [
        {
          id: 1,
          stage: "build_image",
          name: "build_image",
          status: "running",
          started_at: "2026-04-24T09:00:01.000Z",
          finished_at: null,
          duration: null,
          failure_reason: null,
        },
      ],
    })
  );

  await service.savePipelineStatus(
    createGitLabPipeline({
      status: "success",
      detailed_status: "passed",
      finished_at: "2026-04-24T09:04:00.000Z",
      duration: 239,
      builds: [
        {
          id: 1,
          stage: "build_image",
          name: "build_image",
          status: "success",
          started_at: "2026-04-24T09:00:01.000Z",
          finished_at: "2026-04-24T09:03:30.000Z",
          duration: 209,
          failure_reason: null,
        },
        {
          id: 2,
          stage: "restart_services",
          name: "restart_services",
          status: "success",
          started_at: "2026-04-24T09:03:31.000Z",
          finished_at: "2026-04-24T09:04:00.000Z",
          duration: 29,
          failure_reason: null,
        },
      ],
      stages: ["build_image", "restart_services"],
    })
  );

  const current = await service.getPipelineStatus();

  assert.equal(current.status, "success");
  assert.equal(current.history.length, 1);
  assert.deepEqual(current.stages, ["build_image", "restart_services"]);
  assert.equal(current.builds.length, 2);
  assert.equal(current.builds[0].status, "success");
  assert.equal(current.builds[1].name, "restart_services");
});

(async () => {
  let failures = 0;

  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${name}`);
      console.error(error && error.stack ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`compat smoke suite failed with ${failures} failing test(s).`);
    process.exit(1);
  }

  console.log(`compat smoke suite passed (${tests.length} tests).`);
})();
