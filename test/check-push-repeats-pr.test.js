// scripts/check-push-repeats-pr.js (#159) against a small git repo written
// per test. The base repo holds the shapes the script must pass: a workflow
// on `push` to `main` and a bare `pull_request`, `${{ github.run_id }}` in a
// name, `if: always()` on a cleanup step, and a runner variable name in
// Markdown. Each other case edits one file into one difference and asserts
// exit 1 and the line that names it, so removing any rule from the script
// turns a case red. The runner variable names are built from parts here, as
// in the script, so neither file holds one and the script reads both.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repo, "scripts", "check-push-repeats-pr.js");
const CI = ".forgejo/workflows/ci.yml";
const [GH, FJ, FG] = ["GITHUB", "FORGEJO", "FORGE"].map((name) => `${name}_`);
const LIB = ["@actions", "github"].join("/");
const EV = ["event", "Name"].join("");
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
    "README.md": `CI reads ${GH}TOKEN; Markdown is not run.\n`,
    "scripts/build.sh": "echo build\n",
};

let count = 0;
// Commits `files` over the base repo (a null value deletes a base file) and
// runs `script` on that commit from `subdir` of the repo.
function check(files = {}, { script = scriptPath, subdir = "" } = {}) {
    const dir = path.join(root, String(count++));
    for (const [file, content] of Object.entries({ ...base, ...files })) {
        if (content === null) continue;
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), content);
    }
    const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
    git("init", "-q", "-b", "main");
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", "commit", "-qm", "c");
    const sha = git("rev-parse", "HEAD").trim();
    const res = spawnSync(process.execPath, [script, sha], { cwd: path.join(dir, subdir), encoding: "utf8" });
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

function assertPass(files, options) {
    const { status, out } = check(files, options);
    assert.equal(status, 0, out);
    assert.match(out, /the push run repeats the PR run/);
}

function assertDifference(files, pattern, options) {
    const { status, out } = check(files, options);
    assert.equal(status, 1, out);
    assert.match(out, pattern);
    assert.match(out, /wait on main's run/);
    return out;
}

describe("check-push-repeats-pr passes", () => {
    test("the base repo: push to main, a bare pull_request, run_id, if: always()", () => {
        const { status, out } = check();
        assert.equal(status, 0, out);
        assert.match(out, /the push run repeats the PR run \(1 workflow file\(s\), 1 file\(s\) scanned\)/);
    });
    test("triggers written as a list", () => {
        assertPass({ [CI]: edit(baseCi, /on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:/, "on: [push, pull_request]") });
    });
    test("push with no filter, and workflow_dispatch and schedule beside it", () => {
        const ci = edit(baseCi, "  push:\n    branches: [main]\n", "  push:\n  workflow_dispatch:\n  schedule:\n    - cron: '0 3 * * *'\n");
        assertPass({ [CI]: ci });
    });
    test("an action from data.forgejo.org", () => {
        assertPass({ [CI]: ciWith("      - uses: https://data.forgejo.org/actions/setup-node@v7") });
    });
    test("a runner variable name in graphify-out", () => {
        assertPass({ "graphify-out/graph.json": `{"label": "${GH}REF"}\n` });
    });
    test("run from a subfolder of the repo", () => {
        assertPass({}, { subdir: "scripts" });
    });
});

describe("check-push-repeats-pr finds a difference", () => {
    test("a workflow that runs only on push", () => {
        assertDifference({ ".forgejo/workflows/deploy.yml": "on: push\njobs: {}\n" }, /deploy\.yml: no pull_request trigger/);
    });
    test("a push-only workflow in a subfolder of .forgejo/workflows", () => {
        assertDifference({ ".forgejo/workflows/sub/deploy.yaml": "on: push\njobs: {}\n" }, /sub\/deploy\.yaml: no pull_request trigger/);
    });
    test("a push-only workflow, run from a subfolder of the repo", () => {
        assertDifference({ ".forgejo/workflows/deploy.yml": "on: push\njobs: {}\n" }, /deploy\.yml: no pull_request trigger/, { subdir: "scripts" });
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
        assertDifference({ [CI]: ciWith("      - run: echo push", "        if: github.event_name == 'push'") }, /ci\.yml: \.jobs\.test\.steps\[3\]\.if is not always\(\): github\.event_name == 'push'/);
    });
    test("an if: that reads no event", () => {
        assertDifference({ [CI]: ciWith("      - run: npm ci", "        if: steps.cache.outputs.cache-hit != 'true'") }, /steps\[3\]\.if is not always\(\)/);
    });
    test("an if: that starts with always() and goes on", () => {
        assertDifference({ [CI]: ciWith("      - run: echo main", "        if: always() && steps.co.outputs.ref == 'refs/heads/main'") }, /steps\[3\]\.if is not always\(\)/);
    });
    test("an if key written in quotes", () => {
        assertDifference({ [CI]: ciWith("      - run: echo push", "        \"if\": steps.co.outputs.ref == 'refs/heads/main'") }, /steps\[3\]\.if is not always\(\)/);
    });
    test("an if key with a space before its colon", () => {
        assertDifference({ [CI]: ciWith("      - run: echo push", "        if : steps.co.outputs.ref == 'refs/heads/main'") }, /steps\[3\]\.if is not always\(\)/);
    });
    test("github.ref beside github.run_id", () => {
        assertDifference({ [CI]: edit(baseCi, "ci-${{ github.run_id }}", "ci-${{ github.run_id }}-${{ github.ref }}") }, /ci\.yml:10: an expression other than \$\{\{ github\.run_id \}\}: \$\{\{ github\.ref \}\}/);
    });
    test("the index form github['event_name']", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ github['event_name'] }}") }, /ci\.yml:17: an expression other/);
    });
    test("an expression on a step output that follows the event", () => {
        assertDifference({ [CI]: ciWith("      - run: npm run e2e", "        continue-on-error: ${{ steps.co.outputs.ref != 'refs/heads/main' }}") }, /ci\.yml:18: an expression other/);
    });
    test("the forgejo and forge aliases", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ forgejo.event_name }}", "      - run: echo ${{ forge.ref }}") }, /ci\.yml:17: an expression other[\s\S]*ci\.yml:18: an expression other/);
    });
    test("an expression split over lines", () => {
        assertDifference({ [CI]: ciWith("      - run: >-", "          echo ${{", "          github.event_name }}") }, /ci\.yml:18: an expression other/);
    });
    test("an if: in a local action under .forgejo", () => {
        assertDifference({ ".forgejo/actions/setup/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n" }, /\.forgejo\/actions\/setup\/action\.yml: \.runs\.steps\[0\]\.if is not always\(\)/);
    });
    test("an expression in an action.yaml outside .forgejo", () => {
        assertDifference({ "actions/setup/action.yaml": "runs:\n  using: composite\n  steps:\n    - run: echo ${{ github.event_name }}\n" }, /actions\/setup\/action\.yaml:4: an expression other/);
    });
    test("an if: in an action.yml outside .forgejo", () => {
        assertDifference({ "actions/build/action.yml": "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n" }, /actions\/build\/action\.yml: \.runs\.steps\[0\]\.if is not always\(\)/);
    });
    test("a script that reads the ref from the runner", () => {
        assertDifference({ "scripts/build.sh": `echo build\necho "$${GH}REF"\n` }, /scripts\/build\.sh:2:.*names a runner variable/);
    });
    test("a test that reads the event from the runner", () => {
        assertDifference({ "test/e2e.test.js": `if (process.env.${GH}EVENT_NAME === "push") run();\n` }, /test\/e2e\.test\.js:1:.*names a runner variable/);
    });
    test("a module that reads the forgejo and forge variable names", () => {
        assertDifference({ "lib/env.js": `export const ref = process.env.${FJ}REF;\nexport const e = process.env.${FG}EVENT_NAME;\n` }, /lib\/env\.js:1:.*names a runner variable[\s\S]*lib\/env\.js:2:.*names a runner variable/);
    });
    test("a binary file that holds a runner variable name", () => {
        assertDifference({ "bin/tool": `\0\x01${GH}REF\0` }, /bin\/tool matches: reads the event or names a runner variable/);
    });
    test("a script under .forgejo that loads the actions toolkit's github module", () => {
        assertDifference({ ".forgejo/scripts/gate.js": `const { context } = require("${LIB}");\n` }, /\.forgejo\/scripts\/gate\.js:1:.*reads the event/);
    });
    test("a module that reads the toolkit context's event property", () => {
        assertDifference({ "lib/gate.js": `export const onPush = (context) => context.${EV} === "push";\n` }, /lib\/gate\.js:1:.*reads the event/);
    });
    test("a step that uses actions/github-script", () => {
        assertDifference(
            { [CI]: ciWith("      - uses: actions/github-script@v7", "        with:", "          script: core.info('hi')") },
            /ci\.yml: \.jobs\.test\.steps\[3\]\.uses runs code that gets the event: actions\/github-script@v7/,
        );
    });
    test("a job that calls a reusable workflow", () => {
        const ci = `${baseCi}\n  deploy:\n    uses: owner/repo/.forgejo/workflows/deploy.yml@main\n`;
        assertDifference({ [CI]: ci }, /ci\.yml: job deploy calls a reusable workflow: owner\/repo\/\.forgejo\/workflows\/deploy\.yml@main/);
    });
    test("a pull_request filter on branches: [main]", () => {
        assertDifference({ [CI]: edit(baseCi, "  pull_request:", "  pull_request:\n    branches: [main]") }, /ci\.yml: pull_request has a filter/);
    });
    test("an expression in a YAML file under .forgejo that is neither a workflow nor an action", () => {
        assertDifference({ ".forgejo/config/extra.yml": "steps:\n  - run: echo ${{ github.event_name }}\n" }, /\.forgejo\/config\/extra\.yml:2: an expression other/);
    });
});

// Each form below spells an expression that only the decoded YAML holds, so
// the raw-text scan must not report it: a fixture whose JS string lost an
// escape would hold a raw `${{` and fail here.
describe("check-push-repeats-pr finds a difference in the YAML as it decodes", () => {
    const RAW_SCAN = /ci\.yml:\d+: an expression other than/;
    function assertDecoded(extraSteps, pattern) {
        assert.doesNotMatch(assertDifference({ [CI]: ciWith(...extraSteps) }, pattern), RAW_SCAN);
    }

    test("a \\x24 escape in a value", () => {
        assertDecoded(['      - run: "echo \\x24{{ github.event_name }}"'], /ci\.yml:17: \.jobs\.test\.steps\[3\]\.run decodes to an expression other than \$\{\{ github\.run_id \}\}: \$\{\{ github\.event_name \}\}/);
    });
    test("a \\x24 escape in a key", () => {
        assertDecoded(
            ["      - run: npm run lint", "        env:", '          "A\\x24{{ github.ref }}": "1"'],
            /ci\.yml:19: \.jobs\.test\.steps\[3\]\.env\.A\$\{\{ github\.ref \}\} \(key\) decodes to an expression other than \$\{\{ github\.run_id \}\}: \$\{\{ github\.ref \}\}/,
        );
    });
    test("${ spelled with \\u and \\U escapes", () => {
        assertDecoded(['      - run: "echo \\u0024\\U0000007B{ github.event_name }}"'], /ci\.yml:17: \.jobs\.test\.steps\[3\]\.run decodes to an expression other than [^:]*: \$\{\{ github\.event_name \}\}/);
    });
    test("a double-quoted line continuation that joins $ and {{", () => {
        assertDecoded(['      - run: "echo $\\', '          {{ github.event_name }}"'], /ci\.yml:17: \.jobs\.test\.steps\[3\]\.run decodes to an expression other than [^:]*: \$\{\{ github\.event_name \}\}/);
    });
    test("a !!binary value holding an expression in base64", () => {
        const payload = Buffer.from("echo ${{ github.event_name }}").toString("base64");
        assertDifference({ [CI]: ciWith(`      - run: !!binary ${payload}`) }, /ci\.yml:17: \.jobs\.test\.steps\[3\]\.run has a tag: !!binary/);
    });
    test("a !!str tag on a value with no expression", () => {
        assertDifference({ [CI]: ciWith("      - run: !!str npm run lint") }, /ci\.yml:17: \.jobs\.test\.steps\[3\]\.run has a tag: !!str/);
    });
    test("an !!omap whose entry decodes to an expression", () => {
        const out = assertDifference(
            { [CI]: ciWith("      - run: npm run lint", '        with: !!omap [a: "\\x24{{ github.ref }}"]') },
            /ci\.yml:18: \.jobs\.test\.steps\[3\]\.with has a tag: !!omap/,
        );
        assert.match(out, /ci\.yml:18: \.jobs\.test\.steps\[3\]\.with\[0\]\.a decodes to an expression other than [^:]*: \$\{\{ github\.ref \}\}/);
        assert.doesNotMatch(out, RAW_SCAN);
    });
    test("a step written as an alias", () => {
        const ci = "x-step: &lint\n  run: npm run lint\n" + ciWith("      - *lint");
        assertDifference({ [CI]: ci }, /ci\.yml:19: \.jobs\.test\.steps\[3\] is an alias: \*lint/);
    });
    test("a job holding only a merge key whose anchor calls a reusable workflow", () => {
        const ci = "x-reuse: &reuse\n  uses: owner/repo/.forgejo/workflows/deploy.yml@main\n" + baseCi + "\n  deploy:\n    <<: *reuse\n";
        assertDifference({ [CI]: ci }, /ci\.yml:20: \.jobs\.deploy\.<< is an alias: \*reuse/);
    });
    test("a %FOO directive, which the yaml package reads with a warning", () => {
        assertDifference({ [CI]: "%FOO bar\n---\n" + baseCi }, /ci\.yml: not readable as YAML \(Unknown directive %FOO/);
    });
});

test("the script and this test hold none of the names they search for, so the script reads both", () => {
    const names = new RegExp([GH, FJ, FG, LIB, EV].join("|"));
    for (const file of [scriptPath, fileURLToPath(import.meta.url)]) {
        assert.doesNotMatch(readFileSync(file, "utf8"), names, file);
    }
});

describe("check-push-repeats-pr exits 2", () => {
    test("on a SHA the repo lacks", () => {
        const dir = path.join(root, "nosha");
        mkdirSync(dir);
        execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
        const res = spawnSync(process.execPath, [scriptPath, "0123456789abcdef0123456789abcdef01234567"], { cwd: dir, encoding: "utf8" });
        assert.equal(res.status, 2, res.stdout + res.stderr);
    });
    test("when the yaml package is missing", () => {
        const copy = path.join(mkdtempSync(path.join(tmpdir(), "push-repeats-pr-noyaml-")), "check.js");
        copyFileSync(scriptPath, copy);
        try {
            const { status, out } = check({}, { script: copy });
            assert.equal(status, 2, out);
            assert.match(out, /cannot load the yaml package; run npm ci first/);
        } finally {
            rmSync(path.dirname(copy), { recursive: true, force: true });
        }
    });
});
