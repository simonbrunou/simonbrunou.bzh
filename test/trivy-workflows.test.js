// The Trivy gate (#180, AGENTS.md "Trivy gate"): ci.yml's test job scans the
// image it builds, and trivy.yml builds main's image every night and scans it
// the same way. `trivyProblems` lists what keeps the two scans from being the
// same blocking gate: one of the three Trivy steps missing from either copy,
// the copies differing, an `exit-code` other than 1, a key that could skip or
// soften the scan step, and trivy.yml straying from its build, triggers and
// cleanup. The first test runs it on the real workflows; each other case
// edits one copy into one problem and asserts the line that names it, so
// removing any rule turns a case red. Ported from cinder's
// test/code_health/trivy_workflow_test.exs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CI = ".forgejo/workflows/ci.yml";
const TRIVY = ".forgejo/workflows/trivy.yml";
const read = (file) => readFileSync(path.join(root, file), "utf8");

const INSTALL = "Install Trivy";
const DOWNLOAD = "Download the Trivy vulnerability DB";
const ACTION = "aquasecurity/trivy-action";
const SHARED = [INSTALL, DOWNLOAD, ACTION];
const isShared = (label) => (step) =>
    label === ACTION ? String(step?.uses ?? "").startsWith(`${ACTION}@`) : step?.name === label;
// Any other key on the scan step (`if`, `continue-on-error`, `timeout-minutes`)
// could skip it or let the job pass it red.
const ACTION_KEYS = ["env", "uses", "with"];
// The host's backups, updates and CI runner prune, in minutes after midnight
// in Paris (04:00 to 05:45). Forgejo reads the cron in UTC.
const QUIET = [4 * 60, 5 * 60 + 45];
const TRIVY_IMAGE = "simonbrunou-bzh:trivy-${{ github.run_id }}-${{ github.run_attempt }}";
const REMOVE = {
    name: "Remove the scanned image",
    if: "always()",
    run: 'docker image rm -f "$IMAGE" || true',
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Each problem of the two workflow texts, as lines naming the file and the
// step; an empty list means the gate holds.
function trivyProblems(ciText, trivyText) {
    const problems = [];
    const ci = parse(ciText);
    const trivy = parse(trivyText);
    const ciSteps = ci?.jobs?.test?.steps ?? [];
    const jobs = Object.values(trivy?.jobs ?? {});
    if (jobs.length !== 1) problems.push(`${TRIVY}: ${jobs.length} jobs, not 1`);
    const scan = jobs[0] ?? {};
    const scanSteps = scan.steps ?? [];

    const found = {};
    for (const [file, steps] of [
        [CI, ciSteps],
        [TRIVY, scanSteps],
    ]) {
        found[file] = {};
        for (const label of SHARED) {
            const matches = steps.filter(isShared(label));
            if (matches.length !== 1) problems.push(`${file}: ${matches.length} ${label} steps, not 1`);
            else found[file][label] = matches[0];
        }
        const action = found[file][ACTION];
        if (action) {
            const keys = Object.keys(action).sort();
            if (!same(keys, ACTION_KEYS)) problems.push(`${file}: ${ACTION} step has keys ${keys.join(", ")}`);
            const exitCode = action.with?.["exit-code"];
            if (String(exitCode) !== "1") problems.push(`${file}: ${ACTION} exit-code is ${exitCode}, not 1`);
        }
    }
    for (const label of SHARED) {
        const [a, b] = [found[CI][label], found[TRIVY][label]];
        if (a && b && !same(a, b)) problems.push(`${label} step differs between ${CI} and ${TRIVY}`);
    }

    // In ci.yml the scan runs once the image has passed its checks, and
    // before the cleanup removes the image.
    const at = (match) => ciSteps.findIndex(match);
    const order = [
        at((s) => s?.name === "Check routes, files and permissions inside the image"),
        ...SHARED.map((label) => at(isShared(label))),
        at((s) => s?.name === "Remove the container and image"),
    ];
    if (!order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1]))) {
        problems.push(`${CI}: the Trivy steps are not in order between the image check and its removal`);
    }

    // trivy.yml: checkout and build as ci.yml does them, the three steps,
    // then the cleanup.
    const build = ciSteps.find((s) => s?.name === "Build the production image");
    const expected = [ciSteps[0], build, ...SHARED.map((label) => found[CI][label]), REMOVE];
    if (!same(scanSteps, expected)) {
        problems.push(`${TRIVY}: steps are not ci.yml's checkout and build, the Trivy steps, then "${REMOVE.name}"`);
    }
    if (!same(scan.env, { IMAGE: TRIVY_IMAGE })) problems.push(`${TRIVY}: env is not IMAGE: ${TRIVY_IMAGE}`);

    const on = trivy?.on ?? {};
    if (!same(Object.keys(on).sort(), ["schedule", "workflow_dispatch"]) || on.workflow_dispatch != null) {
        problems.push(`${TRIVY}: triggers are not schedule and a bare workflow_dispatch`);
    }
    const crons = [on.schedule ?? []].flat();
    const cron = crons.length === 1 ? crons[0]?.cron : undefined;
    const fields = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(cron));
    if (!fields) {
        problems.push(`${TRIVY}: schedule is not one daily cron at a fixed minute and hour: ${cron}`);
    } else {
        const utc = Number(fields[2]) * 60 + Number(fields[1]);
        // Paris is UTC+1 in winter and UTC+2 in summer.
        for (const offset of [60, 120]) {
            const paris = (utc + offset) % (24 * 60);
            if (paris >= QUIET[0] && paris <= QUIET[1]) {
                problems.push(`${TRIVY}: cron ${cron} runs at ${Math.floor(paris / 60)}:${String(paris % 60).padStart(2, "0")} in Paris, inside 04:00 to 05:45`);
            }
        }
    }
    return problems;
}

test("the Trivy steps of ci.yml and trivy.yml hold the gate", () => {
    assert.deepEqual(trivyProblems(read(CI), read(TRIVY)), []);
});

// Replaces `from` in `text` once, failing the test when `from` is not there
// exactly once, so a case never runs on the unedited workflow by mistake.
function edit(text, from, to) {
    assert.equal(text.split(from).length, 2, `edit: ${JSON.stringify(from)} is not in the text once`);
    return text.replace(from, () => to);
}

// The lines of the step whose first line is `first` (six spaces, a dash), up
// to the next step or the comment above it, each with its newline.
function stepText(text, first) {
    const lines = text.split("\n");
    const start = lines.indexOf(first);
    assert.ok(start >= 0, `stepText: ${first} not found`);
    let end = start + 1;
    while (end < lines.length && !/^ {6}[-#]/.test(lines[end])) end++;
    return lines.slice(start, end).map((line) => `${line}\n`).join("");
}

const dropStep = (text, first) => edit(text, stepText(text, first), "");

function assertProblem(ciText, trivyText, expected) {
    const problems = trivyProblems(ciText, trivyText);
    assert.ok(
        problems.some((p) => p.includes(expected)),
        `expected a problem with ${JSON.stringify(expected)}, got:\n${problems.join("\n")}`,
    );
}

const FIRST_LINE = {
    [INSTALL]: `      - name: ${INSTALL}`,
    [DOWNLOAD]: `      - name: ${DOWNLOAD}`,
    [ACTION]: "      - uses: aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25 # v0.36.0",
};

for (const file of [CI, TRIVY]) {
    for (const label of SHARED) {
        test(`fails when ${file} lacks the ${label} step`, () => {
            const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
            texts[file] = dropStep(texts[file], FIRST_LINE[label]);
            assertProblem(texts[CI], texts[TRIVY], `${file}: 0 ${label} steps, not 1`);
        });
    }

    test(`fails when ${file} holds the ${ACTION} step twice`, () => {
        const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
        const step = stepText(texts[file], FIRST_LINE[ACTION]);
        texts[file] = edit(texts[file], step, `${step}${step}`);
        assertProblem(texts[CI], texts[TRIVY], `${file}: 2 ${ACTION} steps, not 1`);
    });

    for (const [what, from, to] of [
        ["0", "          exit-code: 1\n", "          exit-code: 0\n"],
        ["a string other than 1", "          exit-code: 1\n", '          exit-code: "2"\n'],
        ["missing", "          exit-code: 1\n", ""],
    ]) {
        test(`fails when ${file} sets exit-code to ${what}`, () => {
            const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
            texts[file] = edit(texts[file], from, to);
            const shown = to ? to.trim().replace("exit-code: ", "") : "undefined";
            assertProblem(texts[CI], texts[TRIVY], `${file}: ${ACTION} exit-code is ${shown.replace(/"/g, "")}, not 1`);
        });
    }

    for (const key of ["continue-on-error: true", "if: always()"]) {
        test(`fails when the ${ACTION} step of ${file} has ${key}`, () => {
            const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
            texts[file] = edit(texts[file], `${FIRST_LINE[ACTION]}\n`, `${FIRST_LINE[ACTION]}\n        ${key}\n`);
            assertProblem(texts[CI], texts[TRIVY], `${file}: ${ACTION} step has keys`);
        });
    }
}

test("fails when both copies set exit-code to 0 alike", () => {
    const [ci, trivy] = [CI, TRIVY].map((f) => edit(read(f), "          exit-code: 1\n", "          exit-code: 0\n"));
    const problems = trivyProblems(ci, trivy);
    assert.deepEqual(
        problems.filter((p) => !p.includes("exit-code")),
        [],
        "the copies still match, so only the exit-code rule fires",
    );
    assertProblem(ci, trivy, `${CI}: ${ACTION} exit-code is 0, not 1`);
    assertProblem(ci, trivy, `${TRIVY}: ${ACTION} exit-code is 0, not 1`);
});

for (const [label, file, from, to] of [
    [INSTALL, CI, "trivy_0.70.0_Linux-64bit.tar.gz\n", "trivy_0.69.0_Linux-64bit.tar.gz\n"],
    [DOWNLOAD, TRIVY, "timeout --kill-after=10s 3m", "timeout --kill-after=10s 9m"],
    [ACTION, TRIVY, "severity: HIGH,CRITICAL", "severity: CRITICAL"],
]) {
    test(`fails when the ${label} step of ${file} differs from the other copy`, () => {
        const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
        texts[file] = edit(texts[file], from, to);
        assertProblem(texts[CI], texts[TRIVY], `${label} step differs between ${CI} and ${TRIVY}`);
    });
}

test("fails when ci.yml scans after the image is removed", () => {
    const ci = read(CI);
    const start = ci.indexOf("      # The Trivy gate");
    const end = ci.indexOf("      - name: Remove the container and image");
    const moved = ci.slice(0, start) + ci.slice(end) + ci.slice(start, end);
    assertProblem(moved, read(TRIVY), `${CI}: the Trivy steps are not in order`);
});

for (const [what, from, to] of [
    ["builds the image another way", '        run: docker build --tag "$IMAGE" .\n', '        run: docker build --pull --tag "$IMAGE" .\n'],
    ["keeps the image when a step fails", "        if: always()\n        run: docker image rm", "        run: docker image rm"],
    ["runs a step after the cleanup", '        run: docker image rm -f "$IMAGE" || true\n', '        run: docker image rm -f "$IMAGE" || true\n      - run: echo done\n'],
]) {
    test(`fails when trivy.yml ${what}`, () => {
        assertProblem(read(CI), edit(read(TRIVY), from, to), `${TRIVY}: steps are not ci.yml's checkout and build`);
    });
}

test("fails when trivy.yml tags its image without the run attempt", () => {
    const trivy = edit(read(TRIVY), "-${{ github.run_attempt }}", "");
    assertProblem(read(CI), trivy, `${TRIVY}: env is not IMAGE`);
});

test("fails when trivy.yml has a second job", () => {
    const trivy = `${read(TRIVY)}  other:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo other\n`;
    assertProblem(read(CI), trivy, `${TRIVY}: 2 jobs, not 1`);
});

for (const [what, from, to] of [
    ["also runs on push", "  workflow_dispatch:\n", "  workflow_dispatch:\n  push:\n"],
    ["has no workflow_dispatch", "  workflow_dispatch:\n", ""],
    ["filters workflow_dispatch", "  workflow_dispatch:\n", "  workflow_dispatch:\n    inputs: {}\n"],
]) {
    test(`fails when trivy.yml ${what}`, () => {
        assertProblem(read(CI), edit(read(TRIVY), from, to), `${TRIVY}: triggers are not`);
    });
}

for (const [cron, expected] of [
    ["0 3 * * *", "cron 0 3 * * * runs at 4:00 in Paris"],
    ["45 2 * * *", "cron 45 2 * * * runs at 4:45 in Paris"],
    ["45 3 * * *", "cron 45 3 * * * runs at 5:45 in Paris"],
    ["30 1 * * 1", "schedule is not one daily cron"],
    ["*/30 1 * * *", "schedule is not one daily cron"],
]) {
    test(`fails when trivy.yml's cron is ${cron}`, () => {
        assertProblem(read(CI), edit(read(TRIVY), '"30 1 * * *"', `"${cron}"`), `${TRIVY}: ${expected}`);
    });
}

test("fails when trivy.yml has two crons", () => {
    const trivy = edit(read(TRIVY), '    - cron: "30 1 * * *"\n', '    - cron: "30 1 * * *"\n    - cron: "30 13 * * *"\n');
    assertProblem(read(CI), trivy, `${TRIVY}: schedule is not one daily cron`);
});

test("passes crons just outside the quiet hours", () => {
    for (const cron of ["59 1 * * *", "46 4 * * *"]) {
        assert.deepEqual(trivyProblems(read(CI), edit(read(TRIVY), '"30 1 * * *"', `"${cron}"`)), [], cron);
    }
});
