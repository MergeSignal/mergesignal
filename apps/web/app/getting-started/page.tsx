import docStyles from "../components/shared/DocArticle/DocArticle.module.css";
import { MSCodeBlock } from "../components/shared/MSCodeBlock/MSCodeBlock";
import { productMessaging } from "@mergesignal/shared";
import gsStyles from "./getting-started.module.css";

const REPO_BLOB = "https://github.com/MergeSignal/mergesignal/blob/main";
const README = `${REPO_BLOB}/README.md`;
const ACTION_README = `${REPO_BLOB}/.github/actions/merge-signal-scan/README.md`;
const WORKFLOW_EXAMPLE = `${REPO_BLOB}/docs/examples/mergesignal-scan-with-pull-request.yml`;

const INSTALL_SNIPPET = `git clone https://github.com/MergeSignal/mergesignal.git
cd mergesignal
pnpm install`;

const RUN_SCAN_SAME_REPO = `pnpm ms scan`;

const GHA_RECOMMENDED_SNIPPET = `name: MergeSignal
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  analysis:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: MergeSignal/mergesignal/.github/actions/merge-signal-scan@main
        with:
          scan_profile: trusted
          engine_repo_token: \${{ secrets.MERGESIGNAL_ENGINE_REPO_TOKEN }}`;

export default function GettingStartedPage() {
  return (
    <article className={docStyles.article}>
      <h1>Getting started</h1>
      <p>{productMessaging.formalDefinition}</p>
      <p>
        MergeSignal focuses on the packages changed in your PR, inspects the
        relevant code paths, and reads only the evidence needed to explain
        upgrade risk - keeping reviews targeted without scanning your entire
        repository.
      </p>
      <p>
        Start locally in seconds, then add GitHub Actions for reviewer guidance
        on every upgrade PR.
      </p>

      <section
        id="quick-start"
        className={`${gsStyles.sectionBlock} ${gsStyles.anchorSection}`}
        aria-labelledby="quick-start-heading"
      >
        <h2 id="quick-start-heading">Quick start</h2>
        <p>
          Run a local scan to see affected flows and reviewer checks before
          opening a pull request.
        </p>

        <div className={gsStyles.stepBlock}>
          <p className={gsStyles.stepLabel}>Install</p>
          <MSCodeBlock
            text={INSTALL_SNIPPET}
            copyLabel="Copy install commands"
          />
        </div>

        <div className={gsStyles.stepBlock}>
          <p className={gsStyles.stepLabel}>Run a scan</p>
          <p>
            Run the scan from your project directory, where MergeSignal is
            installed.
          </p>
          <MSCodeBlock
            text={RUN_SCAN_SAME_REPO}
            copyLabel="Copy scan command"
          />
        </div>

        <p>
          Locally you will see upgrade findings, affected entrypoints, and
          reviewer checks in the terminal. More options (JSON export, failing a
          job above a threshold) are in the{" "}
          <a href={README}>repository README</a>.
        </p>

        <p>
          For deeper insights and automated pull request comments, continue
          below.
        </p>
      </section>

      <hr />

      <section
        id="github-actions"
        className={`${gsStyles.sectionBlock} ${gsStyles.anchorSection}`}
        aria-labelledby="pr-product-heading"
      >
        <h2 id="pr-product-heading">GitHub Actions (CI)</h2>
        <p>
          Add a short workflow so every qualifying pull request runs MergeSignal
          in GitHub Actions and writes upgrade findings to the workflow Summary.
        </p>

        <div className={gsStyles.stepBlock}>
          <h3 id="gha-heading">GitHub Actions</h3>
          <p>
            Add a short workflow: check out your repository, then run the
            official MergeSignal action. On each run you get a{" "}
            <strong>Summary</strong> in GitHub Actions with affected flows,
            reviewer guidance, and upgrade findings.
          </p>
          <MSCodeBlock
            text={GHA_RECOMMENDED_SNIPPET}
            copyLabel="Copy workflow YAML"
          />
          <p>
            This example uses <code>@main</code> so you always use the latest
            action from the default branch. To pin a fixed version, use{" "}
            <code>@vX.Y.Z</code> on the action ref — see the{" "}
            <a href={ACTION_README}>action README</a> for versioning details.
          </p>
          <p>
            <strong>Optional - fail the check above a threshold:</strong> add{" "}
            <code>with: fail_above: &quot;40&quot;</code> (use any 0-100
            threshold). The job <strong>fails</strong> when the total score is{" "}
            <strong>strictly higher</strong> than that value; the workflow{" "}
            <strong>Summary is still written first</strong>, so you keep the
            full picture in the Actions tab. Pull requests show a failed check;
            logs mark the threshold step as the failure.
          </p>
          <p>
            First runs can take several minutes while the runner prepares
            MergeSignal-that is expected for now and will improve when the CLI
            ships as a smaller install (Phase 2).
          </p>
          <p>
            <strong>Advanced.</strong> For a full YAML template (including{" "}
            <code>pull_request</code> and artifact upload), see{" "}
            <a href={WORKFLOW_EXAMPLE}>
              <code>mergesignal-scan-with-pull-request.yml</code>
            </a>
            . Operator details:{" "}
            <a
              href={`${REPO_BLOB}/.github/actions/merge-signal-scan/README.md`}
            >
              action README
            </a>
            .
          </p>
        </div>

        <p>
          To automatically comment on pull requests via the MergeSignal GitHub
          App, webhook, and API configuration, see the{" "}
          <a href="#github-app">GitHub App</a> section below.
        </p>
      </section>

      <hr />

      <section
        id="web-dashboard"
        className={`${gsStyles.sectionBlock} ${gsStyles.anchorSection}`}
        aria-labelledby="web-dashboard-heading"
      >
        <h2 id="web-dashboard-heading">Web app</h2>
        <p>
          The MergeSignal web app shows upgrade findings, affected application
          flows, reviewer guidance, and scan history per repository.
        </p>

        <div className={gsStyles.stepBlock}>
          <h3>Sign in</h3>
          <p>
            Click <strong>Continue with GitHub</strong> on the home page. After
            authorizing, you land on the repository overview for your personal
            account.
          </p>
        </div>

        <div className={gsStyles.stepBlock}>
          <h3>Grant organization access</h3>
          <p>
            To see repositories that belong to a GitHub organization, you must
            grant MergeSignal access to that org during the OAuth flow.
          </p>
          <p>
            On the GitHub authorization screen, click <strong>Grant</strong>{" "}
            next to each organization whose repositories you want to monitor.
            Without this step, the org will appear in the org selector but its
            repository list will be empty.
          </p>
          <p>
            Missed it? You can grant access at any time from{" "}
            <a
              href="https://github.com/settings/connections/applications"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/settings/connections/applications
            </a>{" "}
            - find MergeSignal in the list and grant the organizations you need.
          </p>
        </div>

        <div className={gsStyles.stepBlock}>
          <h3>Repository dashboard</h3>
          <p>{productMessaging.dashboardPrCard.intro}</p>
          <p>
            {productMessaging.dashboardPrCard.posture}{" "}
            {productMessaging.dashboardPrCard.exposure}
          </p>
          <p>
            {productMessaging.dashboardPrCard.exposureCategoriesLead}{" "}
            {productMessaging.dashboardPrCard.exposureCategories.join(", ")}.
          </p>
          <p>{productMessaging.dashboardPrCard.cardBody}</p>
        </div>

        <div className={gsStyles.stepBlock}>
          <h3>No scan data yet?</h3>
          <p>
            Repositories that have not been scanned show an empty overview with
            a prompt to run a scan. Complete the{" "}
            <a href="#quick-start">Quick start</a> or{" "}
            <a href="#github-actions">GitHub Actions</a> setup first to populate
            health data.
          </p>
        </div>
      </section>

      <hr />

      <section
        id="github-app"
        className={`${gsStyles.sectionBlock} ${gsStyles.anchorSection}`}
        aria-labelledby="github-app-heading"
      >
        <h2 id="github-app-heading">GitHub App</h2>
        <p>
          Optional: connect a GitHub App to your hosted API so repository events
          (for example lockfile changes on pull requests) can enqueue
          scans-useful when you want ingestion aligned with your deployment, not
          only GitHub Actions.
        </p>

        <h3>What you get</h3>
        <p>
          The <strong>MergeSignal GitHub App</strong> lets your{" "}
          <strong>hosted</strong> MergeSignal API receive repository events.
          When a <strong>lockfile changes</strong> on a pull request or push,
          MergeSignal can <strong>enqueue a scan</strong> so results stay fresh
          without relying on Actions alone-useful when you want ingestion and PR
          automation aligned with your deployment.
        </p>

        <h3>When to use this page</h3>
        <p>
          You already run or plan to run <strong>MergeSignal’s API</strong>{" "}
          (hosted or self-managed) and want <strong>GitHub-driven</strong> scans
          and optional <strong>PR feedback</strong> wired to that stack. This is{" "}
          <strong>optional</strong> and assumes you are comfortable with GitHub
          App permissions and API configuration.
        </p>

        <h3>Prerequisites</h3>
        <ul>
          <li>
            A running MergeSignal <strong>API</strong> reachable from GitHub
            (HTTPS).
          </li>
          <li>
            Ability to create a <strong>GitHub App</strong> in your org or
            account and install it on target repositories.
          </li>
        </ul>

        <h3>Setup</h3>
        <ol>
          <li>
            In GitHub, <strong>create a GitHub App</strong> (org-owned is fine).
          </li>
          <li>
            Set the <strong>webhook URL</strong> to your API’s webhook path-for
            example <code>{`https://<your-api-host>/github/webhook`}</code> (use
            the host where <code>apps/api</code> is deployed).
          </li>
          <li>
            Create a <strong>webhook secret</strong> and keep it for API
            configuration.
          </li>
          <li>
            Subscribe to <strong>Pull request</strong> and <strong>Push</strong>{" "}
            events.
          </li>
          <li>
            Under <strong>Repository permissions</strong>, match how you use
            GitHub:
            <ul>
              <li>
                <strong>Contents</strong>: <strong>Read-only</strong> so
                MergeSignal can read lockfiles from the repository.
              </li>
              <li>
                <strong>Pull requests</strong>: <strong>Read-only</strong> is
                enough for webhook-driven scans (list PR files, read lockfiles).
                Use <strong>Read &amp; write</strong> only if MergeSignal should
                also <strong>write on the pull request</strong> on GitHub (for
                example comments).
              </li>
              <li>
                <strong>Checks</strong>: use <strong>Read &amp; write</strong>{" "}
                when you want scan status on the pull request{" "}
                <strong>Checks</strong> tab (GitHub <strong>Check Runs</strong>
                ). If results only live in MergeSignal, leave Checks unset or
                read-only. Without Read &amp; write, Check Run calls return
                “Resource not accessible by integration”.
              </li>
              <li>
                <strong>Issues</strong>: <strong>Read &amp; write</strong> only
                when the features you enable need that scope (for example
                certain comment paths on GitHub).
              </li>
            </ul>
          </li>
          <li>
            <strong>Install</strong> the App on the repositories (or all repos)
            that should send events.
          </li>
          <li>
            If you later <strong>change</strong> permissions on the App, each
            installation must accept the update: in GitHub, open{" "}
            <strong>Settings → GitHub Apps</strong> (or{" "}
            <strong>Organization settings → Installed GitHub Apps</strong>),
            choose <strong>Configure</strong> for this App, and complete{" "}
            <strong>Review request</strong> until the banner clears. Until then,
            new tokens do not include added scopes.
          </li>
          <li>
            On the API, set <code>GITHUB_APP_ID</code>,{" "}
            <code>GITHUB_PRIVATE_KEY</code> (PEM; newlines may be escaped as{" "}
            <code>\n</code> in env), and <code>GITHUB_WEBHOOK_SECRET</code> to
            match the App.
          </li>
        </ol>
        <p>
          On pull request events (<code>opened</code>, <code>reopened</code>,{" "}
          <code>synchronize</code>), MergeSignal looks for lockfile changes at
          the PR head and enqueues a scan when appropriate. On{" "}
          <strong>push</strong>, it does the same for the pushed commits.
          Supported lockfiles include <code>pnpm-lock.yaml</code>,{" "}
          <code>package-lock.json</code>, and <code>yarn.lock</code> (including
          nested paths).
        </p>

        <h3>What happens next</h3>
        <p>
          Scans surface in the <strong>MergeSignal web app and API</strong> like
          any other run. If you have not yet added GitHub Actions summaries for
          every PR, complete{" "}
          <a href="#github-actions">
            <strong>GitHub Actions</strong>
          </a>{" "}
          first, then return here when you are ready to wire the App to your
          API.
        </p>
        <p>
          For a <strong>local full stack</strong> (Docker, databases,
          migrations), see the{" "}
          <a href={`${REPO_BLOB}/docs/self-host/local-development.md`}>
            local development guide
          </a>{" "}
          in the repository — not this product doc page.
        </p>
      </section>

      <hr />

      <div className={`${gsStyles.stepBlock} ${gsStyles.troubleshootingPanel}`}>
        <h3 id="troubleshooting-heading">Having trouble?</h3>
        <ul className={gsStyles.compactHelpList}>
          <li>
            <strong>Node.js</strong> ≥ 20.19 and <strong>pnpm</strong> 9.x — see
            the <a href={README}>README</a> and repository <code>.nvmrc</code>.
          </li>
          <li>
            You need a lockfile at the project root you scan (for example{" "}
            <code>pnpm-lock.yaml</code> or <code>package-lock.json</code>).
          </li>
          <li>
            CLI quick start and options: <a href={README}>README</a>.
          </li>
          <li>
            Local API, web, and Docker:{" "}
            <a href={`${REPO_BLOB}/docs/self-host/local-development.md`}>
              local development guide
            </a>{" "}
            and <a href={`${REPO_BLOB}/DEPLOYMENT.md`}>DEPLOYMENT.md</a>.
          </li>
          <li>
            <strong>GitHub App</strong> “Resource not accessible by integration”
            on the <strong>Checks</strong> API or <strong>Check Runs</strong>:
            set <strong>Checks</strong> to Read &amp; write on the App and
            complete <strong>Review request</strong> on the installation (see{" "}
            <a href="#github-app">GitHub App</a> setup above).
          </li>
        </ul>
      </div>
    </article>
  );
}
