// The Trivy gate (#180, AGENTS.md "Trivy gate"): ci.yml's test job scans the
// image it builds, and trivy.yml builds main's image every night and scans it
// the same way. `trivyProblems` lists what keeps the two scans from being the
// same blocking gate: one of the three Trivy steps missing from either copy,
// the copies differing once parsed as YAML, an `exit-code` other than 1, a key
// that could skip or soften the scan step, and trivy.yml straying from its
// build, triggers, cron window and cleanup. It reads only the shapes the two
// files use today and names any other shape as a problem. The first test runs
// it on the real workflows; each other case edits one copy into one problem
// and asserts the line that names it, so removing any rule turns a case red.
// The last tests run trivy.yml's "Remove earlier attempts' images" step
// against a stub docker. Ported from cinder's
// test/code_health/trivy_workflow_test.exs and ci_container_attempt_test.exs.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
const EARLIER = "Remove earlier attempts' images";
const REMOVE = {
    name: "Remove the scanned image",
    if: "always()",
    run: 'docker image rm -f "$IMAGE" || true',
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isMap = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const shape = (value) => (Array.isArray(value) ? "a sequence" : isMap(value) ? "a mapping" : JSON.stringify(value));

// Each problem of the two workflow texts, as lines naming the file and the
// step; an empty list means the gate holds.
function trivyProblems(ciText, trivyText) {
    const problems = [];
    const ci = parse(ciText);
    const trivy = parse(trivyText);
    const ciSteps = ci?.jobs?.test?.steps;
    if (!Array.isArray(ciSteps)) problems.push(`${CI}: jobs.test.steps is ${shape(ciSteps)}, not a sequence`);
    if (!isMap(trivy?.jobs)) problems.push(`${TRIVY}: jobs is ${shape(trivy?.jobs)}, not a mapping`);
    const jobs = isMap(trivy?.jobs) ? Object.values(trivy.jobs) : [];
    if (isMap(trivy?.jobs) && jobs.length !== 1) problems.push(`${TRIVY}: ${jobs.length} jobs, not 1`);
    const scan = isMap(jobs[0]) ? jobs[0] : {};
    const scanSteps = scan.steps;
    if (jobs.length === 1 && !Array.isArray(scanSteps)) {
        problems.push(`${TRIVY}: the job's steps are ${shape(scanSteps)}, not a sequence`);
    }
    if (!Array.isArray(ciSteps) || !Array.isArray(scanSteps)) return problems;

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

    // trivy.yml: ci.yml's checkout, the removal of earlier attempts' images
    // (its script runs against the stub below), ci.yml's build, the three
    // steps, then the cleanup.
    const build = ciSteps.find((s) => s?.name === "Build the production image");
    const earlier = {
        name: EARLIER,
        shell: "bash",
        env: { RUN_ATTEMPT: "${{ github.run_attempt }}" },
        run: typeof scanSteps[1]?.run === "string" ? scanSteps[1].run : null,
    };
    const expected = [ciSteps[0], earlier, build, ...SHARED.map((label) => found[CI][label]), REMOVE];
    if (!same(scanSteps, expected)) {
        problems.push(
            `${TRIVY}: steps are not ci.yml's checkout, "${EARLIER}" under bash, ci.yml's build, the Trivy steps, then "${REMOVE.name}"`,
        );
    }
    if (!same(scan.env, { IMAGE: TRIVY_IMAGE })) problems.push(`${TRIVY}: env is not IMAGE: ${TRIVY_IMAGE}`);

    const on = trivy?.on;
    if (!isMap(on)) return [...problems, `${TRIVY}: on is ${shape(on)}, not a mapping`];
    if (!same(Object.keys(on).sort(), ["schedule", "workflow_dispatch"]) || on.workflow_dispatch != null) {
        problems.push(`${TRIVY}: triggers are not schedule and a bare workflow_dispatch`);
    }
    if (!Array.isArray(on.schedule)) {
        return [...problems, `${TRIVY}: schedule is ${shape(on.schedule)}, not a sequence`];
    }
    const cron = on.schedule.length === 1 && isMap(on.schedule[0]) ? on.schedule[0].cron : undefined;
    const fields = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(String(cron));
    if (!fields) {
        problems.push(`${TRIVY}: schedule is not one daily cron at a fixed minute and hour: ${cron}`);
    } else if (Number(fields[1]) > 59 || Number(fields[2]) > 23) {
        problems.push(`${TRIVY}: cron ${cron} has a minute above 59 or an hour above 23`);
    } else {
        const utc = Number(fields[2]) * 60 + Number(fields[1]);
        // Paris is UTC+1 in winter and UTC+2 in summer.
        for (const offset of [60, 120]) {
            const paris = (utc + offset) % (24 * 60);
            if (paris >= QUIET[0] && paris <= QUIET[1]) {
                const clock = `${Math.floor(paris / 60)}:${String(paris % 60).padStart(2, "0")}`;
                problems.push(`${TRIVY}: cron ${cron} runs at ${clock} in Paris, inside 04:00 to 05:45`);
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

// The lines of the one step whose first line starts with `first` (six spaces,
// a dash), up to the next step or the comment above it, each with its newline.
function stepText(text, first) {
    const lines = text.split("\n");
    const starts = lines.flatMap((line, i) => (line.startsWith(first) ? [i] : []));
    assert.equal(starts.length, 1, `stepText: ${first} starts ${starts.length} lines, not 1`);
    let end = starts[0] + 1;
    while (end < lines.length && !/^ {6}[-#]/.test(lines[end])) end++;
    return lines.slice(starts[0], end).map((line) => `${line}\n`).join("");
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
    [ACTION]: `      - uses: ${ACTION}@`,
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
            const first = stepText(texts[file], FIRST_LINE[ACTION]).split("\n")[0];
            texts[file] = edit(texts[file], `${first}\n`, `${first}\n        ${key}\n`);
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

test("passes a scalar quoted in one copy only, since YAML reads the same value", () => {
    const trivy = edit(read(TRIVY), "severity: HIGH,CRITICAL", 'severity: "HIGH,CRITICAL"');
    assert.deepEqual(trivyProblems(read(CI), trivy), []);
});

test("fails when ci.yml scans after the image is removed", () => {
    const ci = read(CI);
    const start = ci.indexOf("      # The Trivy gate");
    const end = ci.indexOf("      - name: Remove the container and image");
    const moved = ci.slice(0, start) + ci.slice(end) + ci.slice(start, end);
    assertProblem(moved, read(TRIVY), `${CI}: the Trivy steps are not in order`);
});

test("fails when trivy.yml checks out another way", () => {
    // Read the pinned line rather than spell it out, so a digest bump in both
    // workflows leaves this case working.
    const trivy = read(TRIVY);
    const checkout = stepText(trivy, "      - uses: actions/checkout@");
    const edited = edit(trivy, checkout, "      - uses: actions/checkout@v7\n");
    assertProblem(read(CI), edited, `${TRIVY}: steps are not ci.yml's checkout`);
});

for (const [what, from, to] of [
    ["builds the image another way", '        run: docker build --tag "$IMAGE" .\n', '        run: docker build --pull --tag "$IMAGE" .\n'],
    ["runs the earlier attempts' removal under sh", "        shell: bash\n", "        shell: sh\n"],
    ["gives the earlier attempts' removal another attempt", "          RUN_ATTEMPT: ${{ github.run_attempt }}\n", "          RUN_ATTEMPT: 1\n"],
    ["keeps the image when a step fails", "        if: always()\n        run: docker image rm", "        run: docker image rm"],
    ["runs a step after the cleanup", '        run: docker image rm -f "$IMAGE" || true\n', '        run: docker image rm -f "$IMAGE" || true\n      - run: echo done\n'],
]) {
    test(`fails when trivy.yml ${what}`, () => {
        assertProblem(read(CI), edit(read(TRIVY), from, to), `${TRIVY}: steps are not ci.yml's checkout`);
    });
}

test("fails when trivy.yml lacks the earlier attempts' removal", () => {
    assertProblem(read(CI), dropStep(read(TRIVY), `      - name: ${EARLIER}`), `${TRIVY}: steps are not ci.yml's checkout`);
});

test("fails when trivy.yml tags its image without the run attempt", () => {
    const trivy = edit(read(TRIVY), "-${{ github.run_attempt }}", "");
    assertProblem(read(CI), trivy, `${TRIVY}: env is not IMAGE`);
});

test("fails when trivy.yml has a second job", () => {
    const trivy = `${read(TRIVY)}  other:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo other\n`;
    assertProblem(read(CI), trivy, `${TRIVY}: 2 jobs, not 1`);
});

for (const [file, from, to, expected] of [
    [CI, "    steps:\n", "    steps:\n      first:\n", `${CI}: jobs.test.steps is a mapping, not a sequence`],
    [TRIVY, "    steps:\n", "    steps:\n      first:\n", `${TRIVY}: the job's steps are a mapping, not a sequence`],
    [TRIVY, "jobs:\n  scan:\n", "jobs: []\nother:\n  scan:\n", `${TRIVY}: jobs is a sequence, not a mapping`],
    [TRIVY, "on:\n  schedule:\n", "on: workflow_dispatch\nnot_on:\n  schedule:\n", `${TRIVY}: on is "workflow_dispatch", not a mapping`],
    [TRIVY, '    - cron: "30 1 * * *"\n', '    cron: "30 1 * * *"\n', `${TRIVY}: schedule is a mapping, not a sequence`],
]) {
    test(`fails, naming the form, on ${expected.split(": ")[1]}`, () => {
        const texts = { [CI]: read(CI), [TRIVY]: read(TRIVY) };
        texts[file] = edit(texts[file], from, to);
        // Indent the old step list one level under the new key, so the
        // mapping holds it.
        if (to.endsWith("first:\n")) {
            const [head, rest] = texts[file].split(to);
            texts[file] = head + to + rest.replace(/^ {6}/gm, "        ");
        }
        assertProblem(texts[CI], texts[TRIVY], expected);
    });
}

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
    ["30 100 * * *", "schedule is not one daily cron"],
    ["60 0 * * *", "cron 60 0 * * * has a minute above 59"],
    ["0 24 * * *", "cron 0 24 * * * has a minute above 59 or an hour above 23"],
]) {
    test(`fails when trivy.yml's cron is ${cron}`, () => {
        assertProblem(read(CI), edit(read(TRIVY), '"30 1 * * *"', `"${cron}"`), `${TRIVY}: ${expected}`);
    });
}

test("fails when trivy.yml has two crons", () => {
    const trivy = edit(read(TRIVY), '    - cron: "30 1 * * *"\n', '    - cron: "30 1 * * *"\n    - cron: "30 13 * * *"\n');
    assertProblem(read(CI), trivy, `${TRIVY}: schedule is not one daily cron`);
});

test("passes crons outside the quiet hours, with one- and two-digit fields", () => {
    for (const cron of ["59 1 * * *", "46 4 * * *", "0 13 * * *", "5 23 * * *", "59 0 * * *"]) {
        assert.deepEqual(trivyProblems(read(CI), edit(read(TRIVY), '"30 1 * * *"', `"${cron}"`)), [], cron);
    }
});

// trivy.yml's "Remove earlier attempts' images" step, run as forgejo-runner
// v13.2.1 runs a `shell: bash` step (`bash --noprofile --norc -e -o pipefail
// <file>`, as cinder's test reads it), with a stub `docker` first on PATH. The
// stub keeps its images as files and fails the one call DOCKER_STUB_FAIL
// names. It answers as cinder's stub does after Docker 29.9: `images --quiet
// <tag>` matches the tag exactly, and `image rm --force` exits 0 on a missing
// tag while printing an error for it.
const STUB = `#!/bin/sh
state=$DOCKER_STUB_STATE
printf '%s\\n' "$*" >>"$state/calls"
call=$1
if [ "$1" = image ]; then call="$1 $2"; fi
if [ "$call" = "\${DOCKER_STUB_FAIL:-}" ]; then
  echo "Error response from daemon: stub failure on $call" >&2
  exit 1
fi
case "$1 $2 $3" in
  "images --quiet "*)
    if [ -e "$state/images/$3" ]; then echo 0123456789ab; fi
    ;;
  "image rm --force")
    if [ -e "$state/images/$4" ]; then rm -f -- "$state/images/$4"; else echo "Error response from daemon: No such image: $4" >&2; fi
    ;;
  *)
    echo "docker stub: unexpected call: $*" >&2
    exit 2
    ;;
esac
`;
const RUN_ID = "5813";
const image = (attempt, run = RUN_ID) => `simonbrunou-bzh:trivy-${run}-${attempt}`;
const stubRoot = mkdtempSync(path.join(tmpdir(), "trivy-attempts-"));
after(() => rmSync(stubRoot, { recursive: true, force: true }));
let stubs = 0;

// Runs the step's own text from trivy.yml with `images` already on the stub
// daemon, and returns the exit status, the output, the docker calls and the
// images left.
function runRemoval({ attempt, images = [], imageName = image(attempt), fail } = {}) {
    const dir = path.join(stubRoot, String(stubs++));
    for (const sub of ["bin", "state/images"]) mkdirSync(path.join(dir, sub), { recursive: true });
    writeFileSync(path.join(dir, "bin", "docker"), STUB);
    chmodSync(path.join(dir, "bin", "docker"), 0o755);
    for (const name of images) writeFileSync(path.join(dir, "state/images", name), "");
    const step = parse(read(TRIVY)).jobs.scan.steps.find((s) => s.name === EARLIER);
    writeFileSync(path.join(dir, "step.sh"), step.run);
    const env = {
        PATH: `${path.join(dir, "bin")}:${process.env.PATH}`,
        IMAGE: imageName,
        RUN_ATTEMPT: attempt,
        DOCKER_STUB_STATE: path.join(dir, "state"),
        ...(fail ? { DOCKER_STUB_FAIL: fail } : {}),
    };
    const res = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", path.join(dir, "step.sh")], {
        env,
        encoding: "utf8",
    });
    const callsFile = path.join(dir, "state", "calls");
    return {
        status: res.status,
        output: res.stdout + res.stderr,
        calls: existsSync(callsFile) ? readFileSync(callsFile, "utf8").split("\n").filter(Boolean) : [],
        images: readdirSync(path.join(dir, "state/images")).sort(),
    };
}

test("the removal step on attempt 1 prints one line and calls no docker", () => {
    const r = runRemoval({ attempt: "1", images: [image(1)] });
    assert.equal(r.status, 0, r.output);
    assert.equal(r.output, "This is attempt 1: no earlier attempt to clean up\n");
    assert.deepEqual(r.calls, []);
    assert.deepEqual(r.images, [image(1)]);
});

test("the removal step reads an earlier attempt that left nothing as absent", () => {
    const r = runRemoval({ attempt: "2" });
    assert.equal(r.status, 0, r.output);
    assert.equal(r.output, `Attempt 1: image ${image(1)} absent\n`);
    assert.deepEqual(r.calls, [`images --quiet ${image(1)}`]);
});

test("the removal step on attempt 3 removes by tag what attempts 1 and 2 left, and nothing else", () => {
    const decoys = [image(10), image(3), image(1, "58130"), image(1, "5814"), "simonbrunou-bzh:ci-5813"];
    const r = runRemoval({ attempt: "3", images: [image(1), image(2), ...decoys] });
    assert.equal(r.status, 0, r.output);
    assert.equal(r.output, `Attempt 1: image ${image(1)} removed\nAttempt 2: image ${image(2)} removed\n`);
    assert.deepEqual(
        r.calls.filter((c) => c.startsWith("image rm")),
        [`image rm --force ${image(1)}`, `image rm --force ${image(2)}`],
    );
    assert.deepEqual(r.images, [...decoys].sort());
});

for (const fail of ["images", "image rm"]) {
    test(`the removal step stops at a failed docker ${fail}, before it reports the attempt`, () => {
        const r = runRemoval({ attempt: "2", images: [image(1)], fail });
        assert.notEqual(r.status, 0, r.output);
        assert.equal(r.output, `Error response from daemon: stub failure on ${fail}\n`);
        assert.ok(r.calls.at(-1).startsWith(`${fail} `), r.calls.join("\n"));
    });
}

for (const attempt of ["", "0", "01", "x", "-1", "1.5", " 2"]) {
    test(`the removal step fails, naming the cause, on run_attempt ${JSON.stringify(attempt)}`, () => {
        const r = runRemoval({ attempt, imageName: image(2) });
        assert.equal(r.status, 1, r.output);
        assert.equal(
            r.output,
            `::error::github.run_attempt is '${attempt}', not a positive integer, so the image names do not tell this run's attempts apart\n`,
        );
        assert.deepEqual(r.calls, []);
    });
}

test("the removal step fails before any docker call when IMAGE lacks the attempt suffix", () => {
    const r = runRemoval({ attempt: "2", imageName: "simonbrunou-bzh:trivy-5813" });
    assert.equal(r.status, 1, r.output);
    assert.equal(r.output, "::error::IMAGE (simonbrunou-bzh:trivy-5813) must end in -2\n");
    assert.deepEqual(r.calls, []);
});
