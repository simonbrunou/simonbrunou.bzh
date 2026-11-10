// Tells the merging agent whether the CI run that a merge starts on `main`
// repeats the PR run's jobs and steps (AGENTS.md, "Merge authority"). Run it
// from a checkout with its dependencies installed (`npm ci`), after
// `git fetch origin`, with the SHA the PR's CI passed:
//
//   node scripts/check-push-repeats-pr.js <pushed SHA>
//
// It reads the files at that SHA through git, not the working tree, and
// prints each difference it finds:
//
// - a workflow anywhere under .forgejo/workflows/ that lacks a `push` or a
//   `pull_request` trigger, filters `pull_request`, filters `push` beyond
//   `branches: [main]`, or has a trigger other than those two, `schedule`
//   and `workflow_dispatch`;
// - in a workflow, in any other YAML file under .forgejo/, or in an
//   action.yml or action.yaml anywhere: an `if` key whose value is not
//   `always()`, and a `${{ }}` expression other than `${{ github.run_id }}`;
// - in any file outside Markdown and graphify-out/, a name made of GITHUB,
//   FORGEJO or FORGE and an underscore, which a script could read the event
//   through. Neither this script nor its test holds one, so both are read.
//
// Exit 0: no difference, so the push run repeats the PR run. Exit 1: it
// printed a difference, so wait on main's run. Exit 2: git failed, the SHA
// is unknown or the `yaml` devDependency is missing; wait too.
// test/check-push-repeats-pr.test.js holds one case per difference.
import { execFileSync } from "node:child_process";

const RUNNER_NAMES = ["GITHUB", "FORGEJO", "FORGE"].map((name) => `${name}_`);
const ALLOWED_TRIGGERS = new Set(["push", "pull_request", "schedule", "workflow_dispatch"]);
const ALLOWED_EXPRESSION = "github.run_id";
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;

function fail(message) {
    console.error(`check-push-repeats-pr: ${message}`);
    process.exit(2);
}

const sha = process.argv[2];
if (!sha || process.argv.length > 3) fail("usage: node scripts/check-push-repeats-pr.js <pushed SHA>");

let parse;
try {
    ({ parse } = await import("yaml"));
} catch {
    fail("cannot load the yaml package; run npm ci first");
}

let cwd = process.cwd();
function git(args, okCodes = [0]) {
    try {
        return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
        if (okCodes.includes(err.status)) return err.stdout;
        fail(`git ${args.join(" ")} failed: ${(err.stderr || err.message).trim()}`);
    }
}

cwd = git(["rev-parse", "--show-toplevel"]).trim();
const commit = git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]).trim();
const files = git(["ls-tree", "-r", "--name-only", "-z", commit]).split("\0").filter(Boolean);
const isYaml = (f) => /\.ya?ml$/.test(f);
const workflows = files.filter((f) => f.startsWith(".forgejo/workflows/") && isYaml(f));
const scanned = files.filter((f) => (f.startsWith(".forgejo/") && isYaml(f)) || /(^|\/)action\.ya?ml$/.test(f));
const differences = [];
if (!workflows.length) differences.push(".forgejo/workflows/: no workflow file");

const isEmpty = (value) => value == null || (typeof value === "object" && Object.keys(value).length === 0);

function pushIsMainOnly(value) {
    if (isEmpty(value)) return true;
    const keys = Object.keys(value);
    const branches = [value.branches].flat();
    return keys.length === 1 && keys[0] === "branches" && branches.length === 1 && branches[0] === "main";
}

function checkTriggers(file, doc) {
    const on = doc?.on;
    let triggers;
    if (typeof on === "string") triggers = { [on]: null };
    else if (Array.isArray(on)) triggers = Object.fromEntries(on.map((t) => [t, null]));
    else if (on && typeof on === "object") triggers = on;
    else return differences.push(`${file}: no on: triggers`);
    for (const name of ["push", "pull_request"]) {
        if (!(name in triggers)) differences.push(`${file}: no ${name} trigger`);
    }
    for (const name of Object.keys(triggers)) {
        if (!ALLOWED_TRIGGERS.has(name)) differences.push(`${file}: trigger ${name}`);
    }
    if ("pull_request" in triggers && !isEmpty(triggers.pull_request)) {
        differences.push(`${file}: pull_request has a filter`);
    }
    if ("push" in triggers && !pushIsMainOnly(triggers.push)) {
        differences.push(`${file}: push has a filter beyond branches: [main]`);
    }
}

// Every `if` key at any depth, however the YAML spells it ("if":, if :).
function checkIfs(file, node, where) {
    if (Array.isArray(node)) return node.forEach((item, i) => checkIfs(file, item, `${where}[${i}]`));
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
        if (key === "if" && String(value).trim() !== "always()") {
            differences.push(`${file}: ${where}.if is not always(): ${String(value).trim()}`);
        }
        checkIfs(file, value, `${where}.${key}`);
    }
}

for (const file of scanned) {
    const text = git(["show", `${commit}:${file}`]);
    for (const match of text.matchAll(EXPRESSION)) {
        if (match[1].trim() !== ALLOWED_EXPRESSION) {
            const line = text.slice(0, match.index).split("\n").length;
            differences.push(`${file}:${line}: an expression other than \${{ ${ALLOWED_EXPRESSION} }}: ${match[0]}`);
        }
    }
    let doc;
    try {
        doc = parse(text);
    } catch (err) {
        differences.push(`${file}: not readable as YAML (${err.message.split("\n")[0]})`);
        continue;
    }
    checkIfs(file, doc, "");
    if (workflows.includes(file)) checkTriggers(file, doc);
}

const pattern = RUNNER_NAMES.join("|");
const hits = git(["grep", "-nE", pattern, commit, "--", ".", ":!*.md", ":!graphify-out"], [0, 1]);
for (const hit of hits.split("\n").filter(Boolean)) {
    differences.push(`${hit.replace(`${commit}:`, "")}: names a runner variable`);
}

if (differences.length) {
    for (const d of differences) console.log(d);
    console.log(`check-push-repeats-pr: ${commit.slice(0, 8)}: ${differences.length} difference(s); wait on main's run`);
    process.exit(1);
}
console.log(
    `check-push-repeats-pr: ${commit.slice(0, 8)}: the push run repeats the PR run ` +
        `(${workflows.length} workflow file(s), ${scanned.length} file(s) scanned)`,
);
