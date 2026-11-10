// Tells the merging agent whether the CI run that a merge starts on `main`
// repeats the PR run's jobs and steps (AGENTS.md, "Merge authority"). Run it
// from a checkout, after `git fetch origin`, with the SHA the PR's CI passed:
//
//   node scripts/check-push-repeats-pr.js <pushed SHA>
//
// It reads the files at that SHA through git, not the working tree, and
// prints each difference it finds:
//
// - a workflow in .forgejo/workflows/ that lacks a `push` or a
//   `pull_request` trigger, filters `pull_request`, filters `push` beyond
//   `branches: [main]`, or has a trigger other than those two, `schedule`
//   and `workflow_dispatch`;
// - in .forgejo/ or any action.yml or action.yaml, a use of the `github`
//   context or its `forgejo` and `forge` aliases other than `run_id`, and
//   any `if:` other than `if: always()`;
// - outside Markdown and graphify-out/, any GITHUB_, FORGEJO_ or FORGE_
//   name, which a script could read the event through.
//
// Exit 0: no difference, so the push run repeats the PR run. Exit 1: a
// difference, so wait on main's run. Exit 2: the script could not read the
// SHA. It reads YAML with the `yaml` devDependency, so run `npm ci` first.
// test/check-push-repeats-pr.test.js holds one case per difference.
import { execFileSync } from "node:child_process";
import { parse } from "yaml";

const SELF = ["scripts/check-push-repeats-pr.js", "test/check-push-repeats-pr.test.js"];
const ALLOWED_TRIGGERS = new Set(["push", "pull_request", "schedule", "workflow_dispatch"]);
const CONTEXT = /\b(github|forgejo|forge)\b(?!\.run_id\b)/;
const IF = /\bif:(?!\s*always\(\)\s*$)/;

const sha = process.argv[2];
if (!sha || process.argv.length > 3) {
    console.error("usage: node scripts/check-push-repeats-pr.js <pushed SHA>");
    process.exit(2);
}

function git(args, okCodes = [0]) {
    try {
        return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    } catch (err) {
        if (okCodes.includes(err.status)) return err.stdout;
        console.error(`check-push-repeats-pr: git ${args.join(" ")} failed: ${(err.stderr || err.message).trim()}`);
        process.exit(2);
    }
}

const commit = git(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]).trim();
const files = git(["ls-tree", "-r", "--name-only", "-z", commit]).split("\0").filter(Boolean);
const workflows = files.filter((f) => /^\.forgejo\/workflows\/[^/]+\.ya?ml$/.test(f));
const scanned = files.filter((f) => f.startsWith(".forgejo/") || /(^|\/)action\.ya?ml$/.test(f));
const differences = [];
if (!workflows.length) differences.push(".forgejo/workflows/: no workflow file");

function isEmpty(value) {
    return value === null || value === undefined || (typeof value === "object" && Object.keys(value).length === 0);
}

function pushIsMainOnly(value) {
    if (isEmpty(value)) return true;
    if (typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    if (keys.length !== 1 || keys[0] !== "branches") return false;
    const branches = [value.branches].flat();
    return branches.length === 1 && branches[0] === "main";
}

for (const file of workflows) {
    let doc;
    try {
        doc = parse(git(["show", `${commit}:${file}`]));
    } catch (err) {
        differences.push(`${file}: not readable as YAML (${err.message.split("\n")[0]})`);
        continue;
    }
    const on = doc?.on;
    let triggers;
    if (typeof on === "string") triggers = { [on]: null };
    else if (Array.isArray(on)) triggers = Object.fromEntries(on.map((t) => [t, null]));
    else if (on && typeof on === "object") triggers = on;
    else {
        differences.push(`${file}: no on: triggers`);
        continue;
    }
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

for (const file of scanned) {
    const lines = git(["show", `${commit}:${file}`]).split("\n");
    lines.forEach((line, i) => {
        if (CONTEXT.test(line)) differences.push(`${file}:${i + 1}: reads the event context: ${line.trim()}`);
        if (IF.test(line)) differences.push(`${file}:${i + 1}: an if: other than always(): ${line.trim()}`);
    });
}

const exclude = [":!*.md", ":!graphify-out", ...SELF.map((f) => `:!${f}`)];
const envHits = git(["grep", "-nIE", "GITHUB_|FORGEJO_|FORGE_", commit, "--", ".", ...exclude], [0, 1]);
for (const hit of envHits.split("\n").filter(Boolean)) {
    differences.push(`${hit.slice(commit.length + 1)}: names a runner variable`);
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
