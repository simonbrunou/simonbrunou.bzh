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
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
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
// Commits `files` over the base repo (a null value deletes a base file) in a
// new repo and returns its folder and the commit's SHA.
function commit(files = {}) {
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
    return { dir, sha: git("rev-parse", "HEAD").trim() };
}

// Commits `files` as `commit` does and runs `script` on that commit from
// `subdir` of the repo.
function check(files = {}, { script = scriptPath, subdir = "" } = {}) {
    const { dir, sha } = commit(files);
    const res = spawnSync(process.execPath, [script, sha], { cwd: path.join(dir, subdir), encoding: "utf8" });
    return { status: res.status, out: res.stdout + res.stderr };
}

// Runs node with `args` from `cwd`, its stdout on a Unix socket that this
// process starts to read 1 s after the child starts, as a busy runner may
// (#175). The reader starts on a timer, not on the child's exit: a child
// that waits for its stdout to drain would never exit.
async function runWithLateReader(args, cwd) {
    // A name in Linux's abstract socket namespace (the leading \0), not a
    // file under the temp folder: a socket path longer than 108 bytes fails
    // with EINVAL, and nix develop nests the temp folder deeper.
    const socketPath = `\0push-repeats-pr-${process.pid}-${count++}`;
    const server = net.createServer({ pauseOnConnect: true });
    server.listen(socketPath);
    await once(server, "listening");
    const accepted = once(server, "connection");
    const client = net.connect(socketPath);
    await once(client, "connect");
    const [reader] = await accepted;
    const child = spawn(process.execPath, args, { cwd, stdio: ["ignore", client, "pipe"] });
    // The child holds its own copy of the socket; closing this one lets the
    // reader see the end once the child exits.
    client.destroy();
    const exited = once(child, "exit");
    let stderr = "";
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    const chunks = [];
    const ended = once(reader, "end");
    // pauseOnConnect leaves the reader paused until resume() is called.
    const timer = setTimeout(() => reader.on("data", (chunk) => chunks.push(chunk)).resume(), 1000);
    try {
        await ended;
        const [status] = await exited;
        return { status, stdout: Buffer.concat(chunks).toString("utf8"), stderr };
    } finally {
        clearTimeout(timer);
        server.close();
    }
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
    test("an alias whose anchor is missing, which parses but does not resolve", () => {
        const out = assertDifference({ [CI]: ciWith("      - *missing") }, /ci\.yml: not readable as YAML \(Unresolved alias/);
        assert.match(out, /ci\.yml:17: \.jobs\.test\.steps\[3\] is an alias: \*missing/);
    });
    test("a %FOO directive, which the yaml package reads with a warning", () => {
        assertDifference({ [CI]: "%FOO bar\n---\n" + baseCi }, /ci\.yml: not readable as YAML \(Unknown directive %FOO/);
    });
    test("a YAML error stops the file's other YAML checks", () => {
        const out = assertDifference({ [CI]: ciWith("      - run: !!str npm run lint", "        run: npm run build") }, /ci\.yml: not readable as YAML \(Map keys must be unique/);
        assert.doesNotMatch(out, /has a tag/);
    });
    test("a sequence and a map inside their own anchors, one holding an if:", () => {
        const out = assertDifference({ [CI]: "x-loop: &loop [*loop]\nx-c: &c {if: y, l: *c}\n" + baseCi }, /ci\.yml:1: \.x-loop\[0\] is an alias: \*loop/);
        assert.match(out, /ci\.yml:2: \.x-c\.l is an alias: \*c/);
        assert.equal(out.match(/is not always\(\)/g)?.length, 1, out.slice(0, 2000));
        assert.doesNotMatch(out.slice(0, 2000), /the script failed/);
    });
    test("an anchor holding an if:, used through two aliases", () => {
        const out = assertDifference({ [CI]: "x: &a {if: y}\np: *a\nq: [*a]\n" + baseCi }, /ci\.yml: \.x\.if is not always\(\): y/);
        assert.match(out, /ci\.yml:2: \.p is an alias: \*a[\s\S]*ci\.yml:3: \.q\[0\] is an alias: \*a/);
        assert.equal(out.match(/is not always\(\)/g)?.length, 1, out);
    });
    test("an if: holding an object whose toString is not a function, and a later file's difference", () => {
        const out = assertDifference(
            { [CI]: ciWith("      - run: npm run lint", "        if: {toString: x}"), ".forgejo/workflows/z.yml": "on: push\njobs: {}\n" },
            /ci\.yml: the script failed while checking it \(Cannot convert object to primitive value/,
        );
        assert.match(out, /z\.yml: no pull_request trigger/);
    });
    test("a %FOO directive, an unknown tag and a !!str tag in one file", () => {
        const out = assertDifference(
            { [CI]: "%FOO bar\n---\n" + ciWith("      - run: !custom npm run lint", "      - run: !!str npm run build") },
            /ci\.yml: not readable as YAML \(Unknown directive %FOO/,
        );
        assert.match(out, /ci\.yml: not readable as YAML \(Unresolved tag: !custom/);
        assert.match(out, /ci\.yml:19: \.jobs\.test\.steps\[3\]\.run has a tag: !custom/);
        assert.match(out, /ci\.yml:20: \.jobs\.test\.steps\[4\]\.run has a tag: !!str/);
    });
});

// Shapes the yaml package builds beyond plain maps, sequences and strings:
// tags, the !!omap, !!pairs and !!set collections, aliases (inside their own
// anchor, or one anchor used many times) and merge keys. Review of #163 found
// a crash or a flood of output in four of them, one round at a time. Each
// shape goes in five places of a workflow, one file per place. Whatever the
// script reports, the run must end on its summary line, with no file it
// failed to check and a bounded output.
describe("check-push-repeats-pr ends on its summary line", () => {
    const deep = `${"{if: y, k: ".repeat(20)}{if: y}${"}".repeat(20)}`;
    const anchors = `x-m: &m {if: y}\nx-s: &s [a]\nx-deep: &deep ${deep}\n`;
    const shapes = {
        "a !!str scalar": "!!str x",
        "a !!binary scalar": "!!binary eA==",
        "an unknown tag on a scalar": "!custom x",
        "a !!map map": "!!map {a: b}",
        "a !!seq sequence": "!!seq [a]",
        "an unknown tag on a map": "!custom {a: b}",
        "an !!omap": "!!omap [a: b]",
        "a !!pairs": "!!pairs [a: b]",
        "an !!omap inside an !!omap": "!!omap [a: !!omap [b: c]]",
        "a !!set": "!!set {a, b}",
        "an alias to a map holding an if:": "*m",
        "an alias to a sequence": "*s",
        "a merge key": "{<<: *m}",
        "a sequence inside its own anchor": "&loop [*loop]",
        "a map inside its own anchor, holding an if:": "&c {if: y, l: *c}",
        "an anchor of 21 nested if: keys, used 50 times": `[${Array(50).fill("*deep").join(", ")}]`,
        "an if: holding a map": "{if: {a: b}}",
        "an if: holding a sequence": "{if: [a]}",
        "a \\x24 escape": '"\\x24{{ github.ref }}"',
    };
    const places = {
        "a step's with": (v) => ciWith("      - run: npm test", `        with: ${v}`),
        "a step's env": (v) => ciWith("      - run: npm test", `        env: {A: ${v}}`),
        "a job": (v) => `${baseCi}\n  extra: ${v}\n`,
        "on:": (v) => edit(baseCi, /on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:/, `on: ${v}`),
        "a top-level key": (v) => `x-extra: ${v}\n${baseCi}`,
    };
    for (const [name, shape] of Object.entries(shapes)) {
        test(name, () => {
            const files = Object.fromEntries(Object.values(places).map((place, i) => [`.forgejo/workflows/p${i}.yml`, anchors + place(shape)]));
            const { status, out } = check(files);
            // Exit 0 ends on the "repeats" line, exit 1 on the count of differences.
            const summary = {
                0: /^check-push-repeats-pr: [0-9a-f]{8}: the push run repeats the PR run \(\d+ workflow file\(s\), \d+ file\(s\) scanned\)$/,
                1: /^check-push-repeats-pr: [0-9a-f]{8}: \d+ difference\(s\); wait on main's run$/,
            }[status];
            assert.ok(summary, `exit ${status}:\n${out.slice(0, 4000)}`);
            assert.match(out.trimEnd().split("\n").at(-1), summary, out.slice(-4000));
            assert.doesNotMatch(out, /the script failed while checking it/, out.slice(0, 4000));
            assert.ok(out.length < 100_000, `${out.length} characters of output:\n${out.slice(0, 4000)}`);
        });
    }

    // spawnSync gives the child a Unix socket as stdout, and Node drops the
    // writes still queued on it when a script calls process.exit, so a test
    // process that read late saw the output end on a difference (#175).
    test("the largest output, read 1 s late", { timeout: 60_000 }, async () => {
        const shape = shapes["an anchor of 21 nested if: keys, used 50 times"];
        const { dir, sha } = commit(Object.fromEntries(Object.values(places).map((place, i) => [`.forgejo/workflows/p${i}.yml`, anchors + place(shape)])));
        const { status, stdout, stderr } = await runWithLateReader([scriptPath, sha], dir);
        assert.equal(status, 1, stderr + stdout.slice(0, 4000));
        const lines = stdout.trimEnd().split("\n");
        assert.match(lines.at(-1), /^check-push-repeats-pr: [0-9a-f]{8}: (\d+) difference\(s\); wait on main's run$/, `${stdout.length} characters, ending:\n${stdout.slice(-2000)}`);
        const differences = Number(lines.at(-1).match(/(\d+) difference/)[1]);
        assert.equal(lines.length, differences + 1, stdout.slice(-2000));

        // A control child prints as many lines of the same length, then
        // calls process.exit(1). If its last line still arrives, this reader
        // is not late enough here to catch the loss, and the check above
        // proved nothing.
        const width = Math.ceil(stdout.length / lines.length);
        const control = `for (let i = 0; i < ${differences}; i++) console.log(String(i).padEnd(${width}, "x"));\nconsole.log("control end");\nprocess.exit(1);\n`;
        const late = await runWithLateReader(["-e", control], dir);
        assert.equal(late.status, 1, late.stderr);
        assert.doesNotMatch(late.stdout, /control end/, `the control child's last line arrived (${late.stdout.length} characters), so a reader 1 s late loses nothing on this machine`);
    });
});

// The three forms the Trivy gate added (#182). Each pass case exits 1
// without its allowance; each difference case asserts the line that one
// limit of an allowance keeps, so removing that limit turns it red.
const TRIVY = ".forgejo/workflows/trivy.yml";
const [TOKEN, WS] = ["TOKEN", "WORKSPACE"].map((name) => GH + name);
const offEvent = [
    "name: Trivy",
    "on:",
    "  schedule:",
    "    - cron: '30 1 * * *'",
    "  workflow_dispatch:",
    "jobs:",
    "  scan:",
    "    runs-on: ubuntu-latest",
    "    env:",
    "      IMAGE: app:trivy-${{ github.run_id }}-${{ github.run_attempt }}",
    "    steps:",
    "      - run: docker build --tag \"$IMAGE\" .",
    "      - uses: aquasecurity/trivy-action@v0",
    "        with:",
    "          image-ref: ${{ env.IMAGE }}",
].join("\n");
const trivyStep = ["      - uses: aquasecurity/trivy-action@v0", "        with:", "          image-ref: ${{ env.IMAGE }}"];
const dbStep = [
    "      - name: Download the Trivy vulnerability DB",
    "        run: |",
    `          if env -u ${TOKEN} timeout 3m \\`,
    `            trivy image --download-db-only --cache-dir "$${WS}/.cache/trivy"; then`,
    "            exit 0",
    "          fi",
    "          exit 1",
];
const RUN_ATTEMPT = /trivy\.yml:\d+: an expression other than [^:]*: \$\{\{ github\.run_attempt \}\}/;
const ENV_RAW = /ci\.yml:\d+: an expression other than [^:]*: \$\{\{ env\.IMAGE \}\}/;
const ENV_DECODED = /ci\.yml:\d+: \S+ decodes to an expression other than [^:]*: \$\{\{ env\.IMAGE \}\}/;
const RUNNER = (file, text) => new RegExp(`${file.replace(/\./g, "\\.")}:\\d+:.*${text}.*: reads the event or names a runner variable`);

function offEventWith(...extra) {
    return `${offEvent}\n${extra.join("\n")}\n`;
}

describe("check-push-repeats-pr passes the Trivy gate's forms", () => {
    test("an off-event workflow with run_attempt and env.IMAGE, triggers as a map", () => {
        assertPass({ [TRIVY]: offEvent });
    });
    test("an off-event workflow, triggers as a list", () => {
        assertPass({ [TRIVY]: edit(offEvent, /on:\n[\s\S]*?workflow_dispatch:/, "on: [schedule, workflow_dispatch]") });
    });
    test("an off-event workflow, its trigger as a string", () => {
        assertPass({ [TRIVY]: edit(offEvent, /on:\n[\s\S]*?workflow_dispatch:/, "on: workflow_dispatch") });
    });
    test("the base workflow plus a trivy-action step reading env.IMAGE", () => {
        assertPass({ [CI]: ciWith(...trivyStep) });
    });
    test("the Trivy DB step in an on-event workflow", () => {
        assertPass({ [CI]: ciWith(...dbStep) });
    });
    test("the Trivy DB step in an off-event workflow", () => {
        assertPass({ [TRIVY]: offEventWith(...dbStep) });
    });
    test("the Trivy DB step with its run on one line", () => {
        const step = ["      - name: Download the Trivy vulnerability DB", `        run: env -u ${TOKEN} trivy image --cache-dir "$${WS}/.cache/trivy"`];
        assertPass({ [CI]: ciWith(...step) });
    });
});

describe("check-push-repeats-pr keeps the limits of an off-event workflow", () => {
    test("plus a push trigger", () => {
        assertDifference({ [TRIVY]: edit(offEvent, "  workflow_dispatch:", "  workflow_dispatch:\n  push:") }, RUN_ATTEMPT);
    });
    test("plus a workflow_call trigger", () => {
        assertDifference({ [TRIVY]: edit(offEvent, "  workflow_dispatch:", "  workflow_dispatch:\n  workflow_call:") }, RUN_ATTEMPT);
    });
    test("an empty on: map", () => {
        assertDifference({ [TRIVY]: edit(offEvent, /on:\n[\s\S]*?workflow_dispatch:/, "on: {}") }, RUN_ATTEMPT);
    });
    test("the missing triggers of an empty on: map", () => {
        assertDifference({ [TRIVY]: edit(offEvent, /on:\n[\s\S]*?workflow_dispatch:/, "on: {}") }, /trivy\.yml: no push trigger/);
    });
    test("a runner name in a run", () => {
        assertDifference({ [TRIVY]: offEventWith(`      - run: echo "$${GH}REF"`) }, RUNNER(TRIVY, `${GH}REF`));
    });
    test("an alias in the file", () => {
        assertDifference({ [TRIVY]: `x-a: &a b\nx-b: *a\n${offEvent}` }, RUN_ATTEMPT);
    });
    test("a !!str tag in the file", () => {
        assertDifference({ [TRIVY]: offEventWith("      - run: !!str npm test") }, RUN_ATTEMPT);
    });
    test("a YAML error in the off-event file", () => {
        assertDifference({ [TRIVY]: offEventWith("      - run: a", "        run: b") }, RUN_ATTEMPT);
    });
    test("a YAML warning in the file", () => {
        assertDifference({ [TRIVY]: `%FOO bar\n---\n${offEvent}` }, RUN_ATTEMPT);
    });
    test("a YAML file under .forgejo that is not a workflow", () => {
        assertDifference({ ".forgejo/config/extra.yml": "on: workflow_dispatch\nsteps:\n  - run: echo ${{ github.ref }}\n" }, /extra\.yml:3: an expression other/);
    });
});

describe("check-push-repeats-pr keeps the limits of env.<NAME>", () => {
    function assertEnvDifference(files) {
        const out = assertDifference(files, ENV_RAW);
        assert.match(out, ENV_DECODED);
    }
    test("the job's IMAGE holds github.ref", () => {
        assertEnvDifference({ [CI]: edit(ciWith(...trivyStep), "ci-${{ github.run_id }}", "ci-${{ github.ref }}") });
    });
    test("the job's IMAGE is not a string", () => {
        assertEnvDifference({ [CI]: edit(ciWith(...trivyStep), "app:ci-${{ github.run_id }}", "5") });
    });
    test("NAME unset", () => {
        assertEnvDifference({ [CI]: edit(ciWith(...trivyStep), "      IMAGE: app:ci-${{ github.run_id }}", "      OTHER: x") });
    });
    test("NAME set only in the workflow's env", () => {
        const ci = edit(ciWith(...trivyStep), "    env:\n      IMAGE: app:ci-${{ github.run_id }}\n", "");
        assertEnvDifference({ [CI]: `env:\n  IMAGE: app:ci-\${{ github.run_id }}\n${ci}` });
    });
    test("NAME set in another job", () => {
        const ci = edit(ciWith(...trivyStep), "    env:\n      IMAGE: app:ci-${{ github.run_id }}\n", "");
        assertEnvDifference({ [CI]: `${ci}  other:\n    runs-on: ubuntu-latest\n    env:\n      IMAGE: app:ci-\${{ github.run_id }}\n    steps:\n      - run: echo\n` });
    });
    test("the step's own env sets NAME", () => {
        assertEnvDifference({ [CI]: ciWith(...trivyStep, "        env:", "          IMAGE: other") });
    });
    test("the step's env written as a list", () => {
        assertEnvDifference({ [CI]: ciWith(...trivyStep, "        env: [A]") });
    });
    test("the index form env['IMAGE']", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ env['IMAGE'] }}") }, /ci\.yml:17: an expression other than [^:]*: \$\{\{ env\['IMAGE'\] \}\}/);
    });
    test("env.IMAGE || github.ref", () => {
        assertDifference({ [CI]: ciWith("      - run: echo ${{ env.IMAGE || github.ref }}") }, /ci\.yml:17: an expression other than [^:]*: \$\{\{ env\.IMAGE \|\| github\.ref \}\}/);
    });
    test("env.IMAGE in a job key outside its steps", () => {
        assertEnvDifference({ [CI]: `${baseCi}\n  other:\n    runs-on: ubuntu-latest\n    env:\n      IMAGE: app:ci-\${{ github.run_id }}\n    container: \${{ env.IMAGE }}\n    steps:\n      - run: echo\n` });
    });
    test("a step written as a bare string", () => {
        assertEnvDifference({ [CI]: ciWith("      - ${{ env.IMAGE }}") });
    });
    // The file holds a workflow's jobs, so only its path keeps it out.
    test("env.IMAGE in an action.yml", () => {
        const out = assertDifference({ ".forgejo/actions/scan/action.yml": ciWith(...trivyStep) }, /action\.yml:19: an expression other than [^:]*: \$\{\{ env\.IMAGE \}\}/);
        assert.match(out, /action\.yml:19: \S+ decodes to an expression other than [^:]*: \$\{\{ env\.IMAGE \}\}/);
    });
    test("a YAML error in the file that reads env.IMAGE", () => {
        assertDifference({ [CI]: ciWith(...trivyStep, "      - run: a", "        run: b") }, ENV_RAW);
    });
});

describe("check-push-repeats-pr keeps the limits of the Trivy DB step", () => {
    const withLine = (line) => [...dbStep.slice(0, -1), line, dbStep.at(-1)];
    test("the token read, not unset", () => {
        assertDifference({ [CI]: ciWith(...withLine(`          echo "$${TOKEN}"`)) }, RUNNER(CI, `echo "\\$${TOKEN}"`));
    });
    test("env -u of a longer name", () => {
        assertDifference({ [CI]: ciWith(...withLine(`          env -u ${TOKEN}X true`)) }, RUNNER(CI, `${TOKEN}X`));
    });
    test("the workspace without /.cache/trivy", () => {
        assertDifference({ [CI]: ciWith(...withLine(`          ls "$${WS}/other"`)) }, RUNNER(CI, `${WS}/other`));
    });
    test("a shell comment line in the run", () => {
        assertDifference({ [CI]: ciWith(...withLine(`          # env -u ${TOKEN} here`)) }, RUNNER(CI, `# env -u ${TOKEN} here`));
    });
    test("the same text in a step with another name", () => {
        assertDifference({ [CI]: ciWith(...edit(dbStep.join("\n"), "Download the Trivy vulnerability DB", "Download the DB").split("\n")) }, RUNNER(CI, `env -u ${TOKEN}`));
    });
    for (const key of ["shell: bash", "env: {A: b}", "if: always()"]) {
        test(`the step plus ${key}`, () => {
            assertDifference({ [CI]: ciWith(...dbStep, `        ${key}`) }, RUNNER(CI, `env -u ${TOKEN}`));
        });
    }
    test("the step's run as a map", () => {
        const step = ["      - name: Download the Trivy vulnerability DB", "        run:", `          a: env -u ${TOKEN} true`];
        assertDifference({ [CI]: ciWith(...step) }, RUNNER(CI, `env -u ${TOKEN}`));
    });
    // The comment holds the allowed form, so only its place keeps it out.
    test("a runner name on the comment line above the step", () => {
        assertDifference({ [CI]: ciWith(`      # env -u ${TOKEN} unsets the job token`, ...dbStep) }, RUNNER(CI, `# env -u ${TOKEN} unsets`));
    });
    test("a runner name on the run's header line", () => {
        assertDifference({ [CI]: ciWith(...edit(dbStep.join("\n"), "run: |", `run: | # env -u ${TOKEN}`).split("\n")) }, RUNNER(CI, `run: \\| # env -u ${TOKEN}`));
    });
    test("a runner name on the line right after the run", () => {
        assertDifference({ [CI]: ciWith(...dbStep, `      - run: env -u ${TOKEN} true`) }, RUNNER(CI, `- run: env -u ${TOKEN} true`));
    });
    // On line 19 of scripts/db.sh, as on the line of ci.yml's DB step that
    // holds the same text, so only the file name tells them apart.
    test("the two forms in a file under scripts/", () => {
        const script = `${"\n".repeat(18)}env -u ${TOKEN} trivy --cache-dir "$${WS}/.cache/trivy"\n`;
        const out = assertDifference({ [CI]: ciWith(...dbStep), "scripts/db.sh": script }, RUNNER("scripts/db.sh", `env -u ${TOKEN}`));
        assert.match(out, /scripts\/db\.sh:19:/);
        assert.doesNotMatch(out, /ci\.yml:19:/);
    });
    // The file holds a workflow's jobs, so only its path keeps it out.
    test("the step in an action.yml", () => {
        assertDifference({ ".forgejo/actions/db/action.yml": ciWith(...dbStep) }, RUNNER(".forgejo/actions/db/action.yml", `env -u ${TOKEN}`));
    });
    test("a YAML error in the file with the DB step", () => {
        assertDifference({ [CI]: ciWith(...dbStep, "      - run: a", "        run: b") }, RUNNER(CI, `env -u ${TOKEN}`));
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
