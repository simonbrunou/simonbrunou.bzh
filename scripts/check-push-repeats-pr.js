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
// - in any file outside Markdown, a name made of GITHUB, FORGEJO or FORGE
//   and an underscore, which a script could read the event through, and the
//   names of the actions toolkit's github module and its event property.
//   Neither this script nor its test holds one, so both are read.
//
// It accepts three forms that the list above would report (#182):
//
// - An off-event workflow: one that reads as YAML with no error, warning,
//   tag or alias, and whose `on`, as a string, a list or a map, names
//   `schedule` or `workflow_dispatch` or both and nothing else. It runs in
//   neither the PR run nor the push run, so its missing `push` and
//   `pull_request` triggers and its `${{ }}` expressions, raw and decoded,
//   pass. Every other check still reads it, the runner-name scan included:
//   `npm test` runs trivy.yml's step text.
// - `${{ env.<NAME> }}`, its body exactly `env.` and an identifier, in a
//   step of a workflow job (`jobs.<id>.steps`), raw and decoded, when that
//   job's own `env` sets NAME to a string whose only expressions are
//   `${{ github.run_id }}` and the step's own `env` does not set NAME. A
//   NAME set only at workflow level or in another job, an index or compound
//   form, and any use outside a workflow's steps still count.
// - In a workflow step whose keys are exactly `name` and `run`, its name
//   `Download the Trivy vulnerability DB`, the runner's token and workspace
//   names (GITHUB, then `_TOKEN` or `_WORKSPACE`) on the lines of its `run`,
//   only as `env -u` of the token and as the workspace followed by
//   `/.cache/trivy`. The scan removes those two forms and reports any name
//   left on the line. A line that starts with `#` gets no allowance.
//
// The last two need a file that reads as YAML with no error.
//
// It cannot see code that branches on commit metadata (the merge commit's
// subject, SHA and parents differ from the pushed SHA's), reads the event
// by a route the list above leaves out, or exports a NAME that a later
// step's `${{ env.<NAME> }}` reads. Such code passes.
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
const OFF_EVENT_TRIGGERS = new Set(["schedule", "workflow_dispatch"]);
const ENV_REFERENCE = /^env\.([A-Za-z_][A-Za-z0-9_]*)$/;
const TRIVY_DB_STEP = "Download the Trivy vulnerability DB";
const [TOKEN, WORKSPACE] = ["TOKEN", "WORKSPACE"].map((name) => RUNNER_NAMES[0] + name);
const TRIVY_DB_FORMS = [new RegExp(`env -u ${TOKEN}(?![A-Za-z0-9_])`, "g"), `$${WORKSPACE}/.cache/trivy`];

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
// ("if":, if :). Each alias resolves to its anchor's value, so `seen` checks
// that value once, where the anchor is: a value used through many aliases
// would otherwise be reported once per path, and one inside its own anchor
// (`&a [*a]`) without end. The walk reports each alias.
function checkKeys(file, node, where, seen = new Set()) {
    if (!node || typeof node !== "object" || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) return node.forEach((item, i) => checkKeys(file, item, `${where}[${i}]`, seen));
    for (const [key, value] of Object.entries(node)) {
        if (key === "if" && String(value).trim() !== "always()") {
            differences.push(`${file}: ${where}.if is not always(): ${String(value).trim()}`);
        }
        if (key === "uses" && String(value).includes("github-script")) {
            differences.push(`${file}: ${where}.uses runs code that gets the event: ${value}`);
        }
        checkKeys(file, value, `${where}.${key}`, seen);
    }
}

// Every node of the file as the `yaml` package decodes it, keys included:
// a tag, an alias, and an expression in a decoded string, which the raw-text
// scan misses when an escape or a line continuation builds it.
function walk(file, read, node, where) {
    if (!node) return;
    // A map's entries, and the items of an `!!omap` or `!!pairs` sequence,
    // which have no range of their own.
    if (YAML.isPair(node)) {
        const path = `${where}.${YAML.isScalar(node.key) ? String(node.key.value) : "?"}`;
        walk(file, read, node.key, `${path} (key)`);
        return walk(file, read, node.value, path);
    }
    const at = `${file}:${read.lines.linePos(node.range[0]).line}: ${where || "the document"}`;
    if (node.tag) differences.push(`${at} has a tag: ${node.tag.replace(/^tag:yaml\.org,2002:/, "!!")}`);
    if (YAML.isAlias(node)) {
        differences.push(`${at} is an alias: *${node.source}`);
    } else if (YAML.isScalar(node)) {
        if (typeof node.value !== "string" || read.offEvent) return;
        for (const match of node.value.matchAll(EXPRESSION)) {
            if (!expressionPasses(match[1], read.steps.get(node))) {
                differences.push(`${at} decodes to an expression other than \${{ ${ALLOWED_EXPRESSION} }}: ${match[0]}`);
            }
        }
    } else if (YAML.isSeq(node)) {
        node.items.forEach((item, i) => walk(file, read, item, `${where}[${i}]`));
    } else if (YAML.isMap(node)) {
        for (const pair of node.items) walk(file, read, pair, where);
    }
}

const isMap = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sets = (env, name) => isMap(env) && Object.hasOwn(env, name);
const onlyRunId = (text) => [...text.matchAll(EXPRESSION)].every((match) => match[1].trim() === ALLOWED_EXPRESSION);

// The body of a `${{ }}` expression passes when it is `github.run_id`, or
// `env.<NAME>` in a step (`step` holds its job's and its own `env`) whose
// job sets NAME to a string holding only `${{ github.run_id }}`.
function expressionPasses(body, step) {
    if (body.trim() === ALLOWED_EXPRESSION) return true;
    const name = body.trim().match(ENV_REFERENCE)?.[1];
    if (!name || !step || !sets(step.jobEnv, name) || step.env != null && (!isMap(step.env) || sets(step.env, name))) return false;
    const value = step.jobEnv[name];
    return typeof value === "string" && onlyRunId(value);
}

// The decoded `on` names `schedule` or `workflow_dispatch` or both, and
// nothing else, as a string, a list or a map.
function isOffEvent(doc) {
    const on = isMap(doc) ? doc.on : undefined;
    let names;
    if (typeof on === "string") names = [on];
    else if (Array.isArray(on)) names = on;
    else if (isMap(on)) names = Object.keys(on);
    else return false;
    return names.length > 0 && names.every((name) => OFF_EVENT_TRIGGERS.has(name));
}

function hasTagOrAlias(parsed) {
    let found = false;
    YAML.visit(parsed, {
        Node(_, node) {
            if (!node.tag && !YAML.isAlias(node)) return undefined;
            found = true;
            return YAML.visit.BREAK;
        },
    });
    return found;
}

// The lines of a scalar's value, without a block scalar's header line.
function valueLines(lines, node) {
    const block = node.type === "BLOCK_LITERAL" || node.type === "BLOCK_FOLDED";
    const first = lines.linePos(node.range[0]).line + (block ? 1 : 0);
    const last = lines.linePos(Math.max(node.range[0], node.range[1] - 1)).line;
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i);
}

// What the allowances need from a workflow read with no YAML error: for
// each scalar (key or value) in a job's step, that step's `env` and its
// job's; and the lines of each Trivy DB step's `run`.
function readSteps(read) {
    const jobs = read.parsed.contents?.get?.("jobs", true);
    if (!YAML.isMap(jobs) || !isMap(read.doc?.jobs)) return;
    for (const pair of jobs.items) {
        const job = YAML.isScalar(pair.key) ? read.doc.jobs[pair.key.value] : undefined;
        const stepNodes = YAML.isMap(pair.value) ? pair.value.get("steps", true) : undefined;
        if (!isMap(job) || !Array.isArray(job.steps) || !YAML.isSeq(stepNodes)) continue;
        stepNodes.items.forEach((stepNode, i) => {
            const step = job.steps[i];
            if (!isMap(step) || !YAML.isMap(stepNode)) return;
            const context = { jobEnv: job.env, env: step.env };
            YAML.visit(stepNode, {
                Scalar(_, node) {
                    read.steps.set(node, context);
                },
            });
            const keys = Object.keys(step).sort().join(" ");
            const run = stepNode.get("run", true);
            if (keys === "name run" && step.name === TRIVY_DB_STEP && YAML.isScalar(run)) {
                for (const line of valueLines(read.lines, run)) read.trivyDbLines.add(line);
            }
        });
    }
}

// Reads a scanned file as YAML once, before any check, since the raw-text
// scan needs to know what the allowances accept.
function readYaml(file, text) {
    const lines = new YAML.LineCounter();
    const parsed = YAML.parseDocument(text, { lineCounter: lines });
    const read = { lines, parsed, doc: undefined, docError: undefined, offEvent: false, steps: new Map(), trivyDbLines: new Set() };
    if (parsed.errors.length) return read;
    try {
        // Throws on an alias whose anchor is missing, which parsing allows.
        read.doc = parsed.toJS();
    } catch (err) {
        read.docError = err;
        return read;
    }
    if (!workflows.includes(file)) return read;
    read.offEvent = !parsed.warnings.length && !hasTagOrAlias(parsed) && isOffEvent(read.doc);
    readSteps(read);
    return read;
}

// Every check of a scanned file that reads it as YAML. An error can leave
// the document half read, so it stops them; a warning does not.
function checkYaml(file, read) {
    const { parsed } = read;
    for (const problem of [...parsed.errors, ...parsed.warnings]) {
        differences.push(`${file}: not readable as YAML (${problem.message.split("\n")[0]})`);
    }
    if (parsed.errors.length) return;
    walk(file, read, parsed.contents, "");
    if (read.docError) return differences.push(`${file}: not readable as YAML (${read.docError.message.split("\n")[0]})`);
    checkKeys(file, read.doc, "");
    if (workflows.includes(file)) {
        if (!read.offEvent) checkTriggers(file, read.doc);
        checkJobs(file, read.doc);
    }
}

// The step of a job that holds the raw text from `start` to `end`, if any.
function stepAt(read, start, end) {
    for (const [node, step] of read.steps) {
        if (node.range[0] <= start && end <= node.range[1]) return step;
    }
    return undefined;
}

const trivyDbLines = new Map();
for (const file of scanned) {
    const text = git(["show", `${commit}:${file}`]);
    // A file that the script fails to read gets no allowance, but the raw
    // scan still reads it.
    let read = { offEvent: false, steps: new Map(), trivyDbLines: new Set() };
    let failure;
    try {
        read = readYaml(file, text);
    } catch (err) {
        failure = err;
    }
    trivyDbLines.set(file, read.trivyDbLines);
    if (!read.offEvent) {
        for (const match of text.matchAll(EXPRESSION)) {
            if (!expressionPasses(match[1], stepAt(read, match.index, match.index + match[0].length))) {
                const line = text.slice(0, match.index).split("\n").length;
                differences.push(`${file}:${line}: an expression other than \${{ ${ALLOWED_EXPRESSION} }}: ${match[0]}`);
            }
        }
    }
    try {
        if (failure) throw failure;
        checkYaml(file, read);
    } catch (err) {
        // A shape the checks do not expect, such as an object with a
        // `toString` key where a string belongs.
        differences.push(`${file}: the script failed while checking it (${err.message.split("\n")[0]})`);
    }
}

const pattern = [...RUNNER_NAMES, ...EVENT_READS].join("|");
const hits = git(["grep", "-nE", pattern, commit, "--", ".", ":!*.md"], [0, 1]);
for (const hit of hits.split("\n").filter(Boolean)) {
    const found = hit.replace(`${commit}:`, "");
    const [, file, line, text] = found.match(/^(.*?):(\d+):(.*)$/) ?? [];
    if (file && trivyDbLines.get(file)?.has(Number(line)) && !text.trimStart().startsWith("#")) {
        const left = TRIVY_DB_FORMS.reduce((rest, form) => rest.replaceAll(form, ""), text);
        if (!new RegExp(pattern).test(left)) continue;
    }
    differences.push(`${found}: reads the event or names a runner variable`);
}

if (differences.length) {
    for (const d of differences) console.log(d);
    console.log(`check-push-repeats-pr: ${commit.slice(0, 8)}: ${differences.length} difference(s); wait on main's run`);
    // Not process.exit(1): it drops the lines still queued for a stdout that
    // its reader drains late, the summary line included (#175).
    process.exitCode = 1;
} else {
    console.log(
        `check-push-repeats-pr: ${commit.slice(0, 8)}: the push run repeats the PR run ` +
            `(${workflows.length} workflow file(s), ${scanned.length} file(s) scanned)`,
    );
}
