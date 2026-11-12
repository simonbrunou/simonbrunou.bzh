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
// - a job that calls a reusable workflow (`jobs.<id>.uses`), whose steps
//   this script cannot read;
// - in a workflow, in any other YAML file under .forgejo/, or in an
//   action.yml or action.yaml anywhere: an `if` key whose value is not
//   `always()`, a `${{ }}` expression other than `${{ github.run_id }}`,
//   and a step that uses actions/github-script, whose code gets the event;
// - in those same files, read as the `yaml` package decodes them:
//   - a `${{ }}` expression other than `${{ github.run_id }}` in a key or a
//     value, so an escape (`\x24`, `\u0024`) or a line continuation that
//     builds one counts, though the raw text holds no `${{`;
//   - a node with a tag (`!!binary`, whose value YAML decodes to bytes,
//     `!!str`, `!custom`), naming the tag. The `yaml` package turns the
//     entries of an `!!omap` or `!!pairs` into plain pairs, so a tag or an
//     anchor on one is lost and only the collection's own tag is named;
//   - an alias (`*name`, `<<: *name` included), naming it: the `yaml`
//     package keeps `<<` as a plain key, so a job holding only `<<: *name`
//     shows no `uses`, and the runner's YAML reader may merge it;
//   - each error and each warning the `yaml` package reads the file with,
//     reported as not readable as YAML. An error stops the file's other
//     YAML checks. A warning (an unknown directive such as `%FOO`, an
//     unknown tag) leaves the file whole, so the other checks still run;
//   - a file whose YAML checks throw (an `if` holding an object with a
//     `toString` key), naming the error, so the files after it are still
//     checked;
// - in any file outside Markdown and graphify-out/, a name made of GITHUB,
//   FORGEJO or FORGE and an underscore, which a script could read the event
//   through, and the names of the actions toolkit's github module and its
//   event property. Neither this script nor its test holds one, so both are
//   read.
//
// It cannot see code that branches on commit metadata (the merge commit's
// subject, SHA and parents differ from the pushed SHA's) or reads the event
// by a route the list above leaves out. Such code passes.
//
// Exit 0: no difference, so the push run repeats the PR run. Exit 1: it
// printed a difference, so wait on main's run. Exit 2: git failed, the SHA
// is unknown or the `yaml` devDependency is missing; wait too.
// test/check-push-repeats-pr.test.js holds one case per difference.
import { execFileSync } from "node:child_process";

const RUNNER_NAMES = ["GITHUB", "FORGEJO", "FORGE"].map((name) => `${name}_`);
// Built from parts, like RUNNER_NAMES, so this file does not match itself.
const EVENT_READS = [["@actions", "github"].join("/"), ["event", "Name"].join("")];
const ALLOWED_TRIGGERS = new Set(["push", "pull_request", "schedule", "workflow_dispatch"]);
const ALLOWED_EXPRESSION = "github.run_id";
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;

function fail(message) {
    console.error(`check-push-repeats-pr: ${message}`);
    process.exit(2);
}

const sha = process.argv[2];
if (!sha || process.argv.length > 3) fail("usage: node scripts/check-push-repeats-pr.js <pushed SHA>");

let YAML;
try {
    YAML = await import("yaml");
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

function checkJobs(file, doc) {
    const jobs = doc?.jobs;
    if (!jobs || typeof jobs !== "object") return;
    for (const [id, job] of Object.entries(jobs)) {
        if (job && typeof job === "object" && "uses" in job) {
            differences.push(`${file}: job ${id} calls a reusable workflow: ${job.uses}`);
        }
    }
}

// Every `if` and `uses` key at any depth, however the YAML spells it
// ("if":, if :). An alias inside its own anchor (`&a [*a]`) makes a value
// that holds itself, so `inside` stops the descent there; the walk reports
// the alias.
function checkKeys(file, node, where, inside = new Set()) {
    if (!node || typeof node !== "object" || inside.has(node)) return;
    inside.add(node);
    if (Array.isArray(node)) node.forEach((item, i) => checkKeys(file, item, `${where}[${i}]`, inside));
    else {
        for (const [key, value] of Object.entries(node)) {
            if (key === "if" && String(value).trim() !== "always()") {
                differences.push(`${file}: ${where}.if is not always(): ${String(value).trim()}`);
            }
            if (key === "uses" && String(value).includes("github-script")) {
                differences.push(`${file}: ${where}.uses runs code that gets the event: ${value}`);
            }
            checkKeys(file, value, `${where}.${key}`, inside);
        }
    }
    inside.delete(node);
}

// Every node of the file as the `yaml` package decodes it, keys included:
// a tag, an alias, and an expression in a decoded string, which the raw-text
// scan misses when an escape or a line continuation builds it.
function walk(file, lines, node, where) {
    if (!node) return;
    // A map's entries, and the items of an `!!omap` or `!!pairs` sequence,
    // which have no range of their own.
    if (YAML.isPair(node)) {
        const path = `${where}.${YAML.isScalar(node.key) ? String(node.key.value) : "?"}`;
        walk(file, lines, node.key, `${path} (key)`);
        return walk(file, lines, node.value, path);
    }
    const at = `${file}:${lines.linePos(node.range[0]).line}: ${where || "the document"}`;
    if (node.tag) differences.push(`${at} has a tag: ${node.tag.replace(/^tag:yaml\.org,2002:/, "!!")}`);
    if (YAML.isAlias(node)) {
        differences.push(`${at} is an alias: *${node.source}`);
    } else if (YAML.isScalar(node)) {
        if (typeof node.value !== "string") return;
        for (const match of node.value.matchAll(EXPRESSION)) {
            if (match[1].trim() !== ALLOWED_EXPRESSION) {
                differences.push(`${at} decodes to an expression other than \${{ ${ALLOWED_EXPRESSION} }}: ${match[0]}`);
            }
        }
    } else if (YAML.isSeq(node)) {
        node.items.forEach((item, i) => walk(file, lines, item, `${where}[${i}]`));
    } else if (YAML.isMap(node)) {
        for (const pair of node.items) walk(file, lines, pair, where);
    }
}

// Every check of a scanned file that reads it as YAML. An error can leave
// the document half read, so it stops them; a warning does not.
function checkYaml(file, text) {
    const lines = new YAML.LineCounter();
    const parsed = YAML.parseDocument(text, { lineCounter: lines });
    for (const problem of [...parsed.errors, ...parsed.warnings]) {
        differences.push(`${file}: not readable as YAML (${problem.message.split("\n")[0]})`);
    }
    if (parsed.errors.length) return;
    walk(file, lines, parsed.contents, "");
    let doc;
    try {
        // Throws on an alias whose anchor is missing, which parsing allows.
        doc = parsed.toJS();
    } catch (err) {
        return differences.push(`${file}: not readable as YAML (${err.message.split("\n")[0]})`);
    }
    checkKeys(file, doc, "");
    if (workflows.includes(file)) {
        checkTriggers(file, doc);
        checkJobs(file, doc);
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
    try {
        checkYaml(file, text);
    } catch (err) {
        // A shape the checks do not expect, such as an object with a
        // `toString` key where a string belongs.
        differences.push(`${file}: the script failed while checking it (${err.message.split("\n")[0]})`);
    }
}

const pattern = [...RUNNER_NAMES, ...EVENT_READS].join("|");
const hits = git(["grep", "-nE", pattern, commit, "--", ".", ":!*.md", ":!graphify-out"], [0, 1]);
for (const hit of hits.split("\n").filter(Boolean)) {
    differences.push(`${hit.replace(`${commit}:`, "")}: reads the event or names a runner variable`);
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
