// scripts/check-push-repeats-pr.js (#159) against a small git repo written
// per test. The base repo holds the shapes the script must pass: a workflow
// on `push` to `main` and a bare `pull_request`, `github.run_id` in a name,
// `if: always()` on a cleanup step, and GITHUB_ in Markdown. Each other case
// edits one file into one difference and asserts exit 1 and the line that
// names it, so removing any rule from the script turns a case red.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repo, "scripts", "check-push-repeats-pr.js");
const CI = ".forgejo/workflows/ci.yml";
const root = mkdtempSync(path.join(tmpdir(), "push-repeats-pr-"));
after(() => rmSync(root, { recursive: true, force: true }));

const baseCi = [
    "name: CI",
    "on:",
    "  push:",
    "    branches: [main]",
    "  pull_request:",
    "jobs:",
    "  test:",
    "    runs-on: ubuntu-latest",
    "    env:",
    "      IMAGE: app:ci-${{ github.run_id }}",
    "    steps:",
    "      - uses: actions/checkout@v7",
    "      - run: npm test",
    "      - name: Clean up",
    "        if: always()",
    "        run: docker rm -f app",
].join("\n");
const base = {
    [CI]: baseCi,
    "README.md": "CI reads GITHUB_TOKEN; Markdown is not run.\n",
    "scripts/build.sh": "echo build\n",
};

let count = 0;
// Commits `files` over the base repo (a null value deletes a base file) and
// runs the script on that commit.
function check(files = {}) {
    const dir = path.join(root, String(count++));
    const all = { ...base, ...files };
    for (const [file, content] of Object.entries(all)) {
        if (content === null) continue;
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), content);
    }
    const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "c");
    const sha = git("rev-parse", "HEAD").trim();
    const res = spawnSync(process.execPath, [scriptPath, sha], { cwd: dir, encoding: "utf8" });
    return { status: res.status, out: res.stdout + res.stderr };
}

// Replaces `from` in `text`, failing the test when `from` is not there, so a
// case never runs on the unedited base by mistake.
function edit(text, from, to) {
    const out = text.replace(from, to);
    assert.notEqual(out, text, `edit: ${from} not found`);
    return out;
}

function ciWith(...extraSteps) {
    return `${baseCi}\n${extraSteps.join("\n")}\n`;
}

function assertDifference(files, pattern) {
    const { status, out } = check(files);
    assert.equal(status, 1, out);
    assert.match(out, pattern);
    assert.match(out, /wait on main's run/);
}

describe("check-push-repeats-pr passes", () => {
    test("the base repo: push to main, a bare pull_request, run_id, if: always()", () => {
        const { status, out } = check();
        assert.equal(status, 0, out);
        assert.match(out, /the push run repeats the PR run \(1 workflow file\(s\), 1 file\(s\) scanned\)/);
    });
    test("triggers written as a list", () => {
        const { status, out } = check({ [CI]: edit(baseCi, /on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:/, "on: [push, pull_request]") });
        assert.equal(status, 0, out);
    });
    test("push with no filter, and workflow_dispatch and schedule beside it", () => {
        const ci = edit(baseCi, "  push:\n    branches: [main]\n", "  push:\n  workflow_dispatch:\n  schedule:\n    - cron: '0 3 * * *'\n");
        const { status, out } = check({ [CI]: ci });
        assert.equal(status, 0, out);
    });
    test("the script and this test, which name GITHUB_ and FORGEJO_", () => {
        const names = "// GITHUB_ FORGEJO_ FORGE_\n";
        const { status, out } = check({ "scripts/check-push-repeats-pr.js": names, "test/check-push-repeats-pr.test.js": names });
        assert.equal(status, 0, out);
    });
});

describe("check-push-repeats-pr finds a difference", () => {
    test("a workflow that runs only on push", () => {
        assertDifference({ ".forgejo/workflows/deploy.yml": "on: push\njobs: {}\n" }, /deploy\.yml: no pull_request trigger/);
    });
    test("a workflow that runs only on pull_request", () => {
        assertDifference({ ".forgejo/workflows/lint.yml": "on:\n  pull_request:\njobs: {}\n" }, /lint\.yml: no push trigger/);
    });
    test("a trigger other than push, pull_request, schedule and workflow_dispatch", () => {
        assertDifference({ [CI]: edit(baseCi, "  pull_request:", "  pull_request:\n  workflow_run:\n    workflows: [Build]") }, /ci\.yml: trigger workflow_run/);
    });
    test("a pull_request filter", () => {
        assertDifference({ [CI]: edit(baseCi, "  pull_request:", "  pull_request:\n    paths: ['src/**']") }, /ci\.yml: pull_request has a filter/);
    });
    test("a push filter beyond branches: [main]", () => {
        assertDifference({ [CI]: edit(baseCi, "    branches: [main]", "    branches: [main]\n    paths-ignore: ['**.md']") }, /ci\.yml: push has a filter beyond branches: \[main\]/);
    });
    test("push on main and another branch", () => {
        assertDifference({ [CI]: edit(baseCi, "branches: [main]", "branches: [main, dev]") }, /ci\.yml: push has a filter beyond branches: \[main\]/);
    });
    test("push on another branch only", () => {
        assertDifference({ [CI]: edit(baseCi, "branches: [main]", "branches: dev") }, /ci\.yml: push has a filter beyond branches: \[main\]/);
    });
    test("a workflow with no on:", () => {
        assertDifference({ ".forgejo/workflows/empty.yml": "jobs: {}\n" }, /empty\.yml: no on: triggers/);
    });
    test("a workflow that is not YAML", () => {
        assertDifference({ ".forgejo/workflows/broken.yml": "on: [push\n" }, /broken\.yml: not readable as YAML/);
    });
    test("no workflow at all", () => {
        assertDifference({ [CI]: null }, /\.forgejo\/workflows\/: no workflow file/);
    });
    test("an if: on github.event_name", () => {
        assertDifference({ [CI]: ciWith("      - run: echo push", "        if: github.event_name == 'push'") }, /ci\.yml:18: reads the event context[\s\S]*ci\.yml:18: an if: other than always\(\)/);
    });
    test("github.ref on the same line as github.run_id", () => {
        assertDifference({ [CI]: edit(baseCi, "ci-${{ github.run_id }}", "ci-${{ github.run_id }}-${{ github.ref }}") }, /ci\.yml:10: reads the event context/);
    });
    test("the index form github['event_name']", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ github['event_name'] }}") }, /ci\.yml:17: reads the event context/);
    });
    test("github.event_name outside an if:", () => {
        assertDifference({ [CI]: ciWith("      - run: npm run e2e", "        continue-on-error: ${{ github.event_name == 'push' }}") }, /ci\.yml:18: reads the event context/);
    });
    test("the forgejo and forge aliases", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ forgejo.event_name }}", "      - run: echo ${{ forge.ref }}") }, /ci\.yml:17: reads the event context[\s\S]*ci\.yml:18: reads the event context/);
    });
    test("an if: that reads no event", () => {
        assertDifference({ [CI]: ciWith("      - run: npm ci", "        if: steps.cache.outputs.cache-hit != 'true'") }, /ci\.yml:18: an if: other than always\(\)/);
    });
    test("an if: in a local action under .forgejo", () => {
        assertDifference({ ".forgejo/actions/setup/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n" }, /\.forgejo\/actions\/setup\/action\.yml:5: an if: other than always\(\)/);
    });
    test("an event read in a local action outside .forgejo", () => {
        assertDifference({ "actions/setup/action.yaml": "runs:\n  using: composite\n  steps:\n    - run: echo ${{ github.event_name }}\n" }, /actions\/setup\/action\.yaml:4: reads the event context/);
    });
    test("a script that reads GITHUB_REF", () => {
        assertDifference({ "scripts/build.sh": "echo build\necho \"$GITHUB_REF\"\n" }, /scripts\/build\.sh:2:.*names a runner variable/);
    });
    test("a module that reads FORGEJO_ or FORGE_ variables", () => {
        assertDifference({ "lib/env.js": "export const ref = process.env.FORGEJO_REF;\nexport const e = process.env.FORGE_EVENT_NAME;\n" }, /lib\/env\.js:1:.*names a runner variable[\s\S]*lib\/env\.js:2:.*names a runner variable/);
    });
});

test("check-push-repeats-pr exits 2 on a SHA the repo lacks", () => {
    const dir = path.join(root, "nosha");
    mkdirSync(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    const res = spawnSync(process.execPath, [scriptPath, "0123456789abcdef0123456789abcdef01234567"], { cwd: dir, encoding: "utf8" });
    assert.equal(res.status, 2, res.stdout + res.stderr);
});
