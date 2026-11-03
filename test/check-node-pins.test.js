// scripts/check-node-pins.sh (#140) against small pin files written per test,
// so every line number below is exact and no edit to the repo's own
// workflows, Dockerfile or package.json moves it. The fixture holds the
// shapes the script must read: three setup-node steps, three node stages, a
// FROM that builds on an earlier stage, a stage of another image and
// engines.node. A test edits one line into one failure class and asserts
// the exit code and the message that names the pin. The cases at the end
// compare the check with a YAML parser instead: they assert only that the
// check never passes a workflow the parser reads as a violation.
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repo, "scripts", "check-node-pins.sh");
const CI = ".forgejo/workflows/ci.yml";

const ciLines = [
    "name: CI", // 1
    "on: pull_request",
    "jobs:",
    "  a:",
    "    runs-on: ubuntu-latest", // 5
    "    steps:",
    "      - uses: actions/checkout@v7",
    "      - uses: actions/setup-node@v7", // 8: a step that opens on its `- uses:`
    "        with:",
    "          node-version: 24", // 10
    "      - run: npm ci",
    "  b:",
    "    steps:",
    "      - name: Set up Node",
    '        uses: "actions/setup-node@v7"', // 15: quoted, after `- name:`
    "        with:",
    "      # a comment at the dash column, inside the open step",
    "",
    "          cache: npm",
    '          node-version: "24.x" # pinned', // 20
    "      - run: echo b",
    "  c:",
    "    steps:",
    "    - name: Set up Node after a nested list",
    "      env:", // 25
    "        LIST:",
    "          - item",
    "      uses: https://data.forgejo.org/actions/setup-node@v7", // 28: a full URL, the last step of the file
    "      with: # the setup-node inputs",
    "        node-version: '24.12.0'", // 30
];
const dockerLines = [
    "# syntax=docker/dockerfile:1.28", // 1
    "FROM node:24-alpine AS builder", // 2
    "RUN npm ci",
    "FROM --platform=linux/amd64 docker.io/library/node:24.12.0-bookworm-slim@sha256:0123abcd AS deps", // 4
    "FROM builder AS test", // 5: builds on the stage of line 2
    "from node:24 as runtime", // 6: lowercase keywords
    "FROM caddy:2-alpine AS runner", // 7: not a node image
    "COPY --from=builder /app /srv",
];
const files = {
    [CI]: `${ciLines.join("\n")}\n`,
    Dockerfile: `${dockerLines.join("\n")}\n`,
    "package.json": `${JSON.stringify({ engines: { node: "24.x" } }, null, 2)}\n`,
};
const ALL = "7 pins read Node 24";

const base = mkdtempSync(path.join(tmpdir(), "check-node-pins-"));
after(() => rmSync(base, { recursive: true, force: true }));

// A fresh copy of the fixture, and the edits and runs a test makes on it.
function fixture() {
    const dir = mkdtempSync(path.join(base, "case-"));
    mkdirSync(path.join(dir, ".forgejo", "workflows"), { recursive: true });
    for (const [file, text] of Object.entries(files)) writeFileSync(path.join(dir, file), text);
    const f = {
        dir,
        write(file, text) {
            writeFileSync(path.join(dir, file), text);
        },
        // Replace line `at` (1-based) of `file` with `text`, which may hold several lines.
        setLine(file, at, text) {
            const p = path.join(dir, file);
            const lines = readFileSync(p, "utf8").split("\n");
            if (at < 1 || at > lines.length) throw new Error(`${file} has no line ${at}`);
            lines[at - 1] = text;
            writeFileSync(p, lines.join("\n"));
        },
        // Move every pin of the fixture to `major`.
        setMajor(major) {
            for (const at of [10, 20, 30]) f.setLine(CI, at, ciLines[at - 1].replace("24", major));
            for (const at of [2, 4, 6]) f.setLine("Dockerfile", at, dockerLines[at - 1].replace("node:24", `node:${major}`));
            f.writePackage({ engines: { node: `${major}.x` } });
        },
        writePackage(pkg) {
            f.write("package.json", JSON.stringify(pkg));
        },
        run(args = [dir], env = process.env) {
            const p = spawnSync(scriptPath, args, { encoding: "utf8", env });
            return { code: p.status, out: p.stdout, err: p.stderr };
        },
        // Expect exit 0 with `message` on stdout; returns stderr.
        passesWith(message) {
            const { code, out, err } = f.run();
            assert.equal(code, 0, err);
            assert.ok(out.includes(message), out);
            return err;
        },
        // Expect exit 1 with every message on stderr; returns stderr.
        failsWith(...messages) {
            const { code, err } = f.run();
            assert.equal(code, 1, err);
            for (const message of messages) assert.ok(err.includes(message), `${message}\nnot in:\n${err}`);
            return err;
        },
    };
    return f;
}

// Passes.

test("passes on the repo pins", () => {
    const { code, out, err } = fixture().run([repo]);
    assert.equal(code, 0, err);
    assert.match(out, /pins read Node \d+/);
});

test("passes on every shape of the fixture, reading all seven pins", () => {
    fixture().passesWith(ALL);
});

test("passes on CRLF line endings", () => {
    const f = fixture();
    for (const [file, text] of Object.entries(files)) f.write(file, text.replaceAll("\n", "\r\n"));
    f.passesWith(ALL);
});

for (const value of ["v24", "24.12", "'24'", '"24.x"', "24 # the LTS"]) {
    test(`passes on a node-version of ${value}`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          node-version: ${value}`);
        f.passesWith(ALL);
    });
}

for (const range of ["24", "^24.0.0", "~24.1.0", "24.12.4", "v24", "24.x.x"]) {
    test(`passes on engines.node ${range}`, () => {
        const f = fixture();
        f.writePackage({ engines: { node: range } });
        f.passesWith(ALL);
    });
}

for (const key of ["devDependencies", "dependencies"]) {
    test(`passes on @types/node in ${key}, reading it as an eighth pin`, () => {
        const f = fixture();
        f.writePackage({ engines: { node: "24.x" }, [key]: { "@types/node": "^24.12.4" } });
        f.passesWith(`8 pins read Node 24 (${CI}:10, ${CI}:20, ${CI}:30, Dockerfile:2, Dockerfile:4, Dockerfile:6, package.json engines.node, package.json ${key} @types/node)`);
    });
}

test("passes on @types/node in both devDependencies and dependencies, reading each", () => {
    const f = fixture();
    const types = { "@types/node": "^24.12.4" };
    f.writePackage({ engines: { node: "24.x" }, devDependencies: types, dependencies: types });
    f.passesWith("9 pins read Node 24");
});

// The body of a block scalar is shell text: what it says about node-version
// or setup-node is no pin.
const body = ['echo "node-version: 26"', 'echo "uses: actions/setup-node@v7"', "node-version: 26"];
for (const [name, text] of [
    ["- run: |", ["      - run: |", ...body.map((l) => `          ${l}`)]],
    ["run: >- under - name:", ["      - name: Build", "        run: >-", ...body.map((l) => `          ${l}`)]],
]) {
    test(`passes on a block scalar body (${name}) that mentions node-version and setup-node`, () => {
        const f = fixture();
        f.setLine(CI, 11, text.join("\n"));
        f.passesWith(ALL);
    });
}

for (const withLine of ["with: &inputs", "with: !!map # tagged", "with: !!map &inputs"]) {
    test(`passes on a block mapping of inputs named first: ${withLine}`, () => {
        const f = fixture();
        f.setLine(CI, 9, `        ${withLine}`);
        f.passesWith(ALL);
    });
}

// A quote, a \, a *, a ? or a ! is YAML syntax only where a node starts,
// outside a comment and a block scalar body: anywhere else it is text.
for (const [name, text] of [
    ["a plain scalar holding quotes", '      - run: docker build --tag "$IMAGE" .'],
    ["a comment holding an apostrophe", "      - run: npm ci # the runner's npm"],
    ["a comment naming the action", "      - run: npm ci # set up by actions/setup-node@v7"],
    ["a plain scalar holding ${{ ... }}", "      - run: npm ci\n        env:\n          IMAGE: simonbrunou-bzh:ci-${{ github.run_id }}"],
    ["an if: holding ${{ !cancelled() }}", "      - if: ${{ !cancelled() }}\n        run: echo \"done!\""],
    [
        "a block scalar body holding YAML syntax",
        [
            "      - run: |",
            '          echo "a\\b" * ?',
            "          ? uses",
            "          - uses: !!binary YWN0aW9ucy9zZXR1cC1ub2RlQHY3",
            "          node-version: *pin",
            "          echo 'open",
            "          cache: {a: 1,",
        ].join("\n"),
    ],
]) {
    test(`passes on ${name}`, () => {
        const f = fixture();
        f.setLine(CI, 11, text);
        f.passesWith(ALL);
    });
}

for (const [name, at, text] of [
    ["a quoted uses key", 15, `        'uses': "actions/setup-node@v7"`],
    ["an anchor before the action of uses:", 8, "      - uses: &setup actions/setup-node@v7"],
]) {
    test(`passes on a setup-node step with ${name}, reading its node-version`, () => {
        const f = fixture();
        f.setLine(CI, at, text);
        f.passesWith(ALL);
    });
}

// A quoted key is the same YAML key as a plain one (#146).
for (const input of ['"node-version": 24', "'node-version': 24", '"node-version": "24.x"', '"node-version" : 24']) {
    test(`passes on a quoted node-version key: ${input}`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          ${input}`);
        f.passesWith(ALL);
    });
}

test("passes on a second workflow without a setup-node step", () => {
    const f = fixture();
    f.write(".forgejo/workflows/pdf.yaml", "jobs:\n  pdf:\n    steps:\n      - run: echo pdf\n");
    f.passesWith(ALL);
});

// A | or > that starts a line after a plain value goes on that value as text
// (#151).
test("passes on a plain scalar that goes on in a line starting with | or >", () => {
    const f = fixture();
    f.setLine(CI, 11, "      - run: cat file\n          | grep x\n      - run: echo hello\n          > out.txt");
    f.passesWith(ALL);
});

// Job d puts the keys of its item at column 8 after a dash at column 4; in
// job e, keys at column 8 belong to the dash at column 6 on the line before
// (#151).
test("passes on a list item whose keys start on the line after its dash", () => {
    const f = fixture();
    f.setLine(
        CI,
        30,
        [
            ciLines[29],
            "  d:",
            "    steps:",
            "    -   uses: actions/checkout@v7",
            "  e:",
            "    steps:",
            "      -",
            "        uses: actions/setup-node@v7",
            "        with:",
            "          node-version: 24",
            "      - uses: actions/setup-node@v7",
            "        with:",
            "          node-version: 24",
        ].join("\n"),
    );
    f.passesWith("9 pins read Node 24");
});

test("passes on a FROM that builds on an earlier stage named node", () => {
    const f = fixture();
    f.setLine("Dockerfile", 2, "FROM node:24-alpine AS node");
    f.setLine("Dockerfile", 5, "FROM node AS test");
    f.passesWith(ALL);
});

test("passes on a registry with a port", () => {
    const f = fixture();
    f.setLine("Dockerfile", 6, "FROM localhost:5000/node:24-alpine");
    f.passesWith(ALL);
});

test("passes on a FROM continued over lines that hold a comment and a blank line", () => {
    const f = fixture();
    f.setLine(
        "Dockerfile",
        4,
        "FROM --platform=linux/amd64 \\\n  # the deps stage\n\n  docker.io/library/node:24.12.0-bookworm-slim \\\n  AS deps",
    );
    f.passesWith(ALL);
});

// Warns, and still passes.

test("warns when the shell runs another Node major than the pins", () => {
    const f = fixture();
    f.setMajor("99");
    assert.match(f.passesWith("7 pins read Node 99"), /warning: this shell runs Node/);
});

test("does not warn when the shell runs the pinned major", () => {
    const f = fixture();
    const running = execFileSync("node", ["--version"], { encoding: "utf8" }).replace(/^v/, "").split(".")[0];
    f.setMajor(running);
    assert.equal(f.passesWith(`7 pins read Node ${running}`), "");
});

// Fails when a pin differs, listing every pin.

for (const at of [10, 20, 30]) {
    test(`fails on the ${CI} input on line ${at}`, () => {
        const f = fixture();
        f.setLine(CI, at, ciLines[at - 1].replace("24", "26"));
        f.failsWith("the Node majors differ", `${CI}:${at}  26 (`, "Dockerfile:2  24 (node:24-alpine)");
    });
}

test("fails on a setup-node step of a second workflow", () => {
    const f = fixture();
    f.write(
        ".forgejo/workflows/pdf.yaml",
        "jobs:\n  pdf:\n    steps:\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 26\n",
    );
    f.failsWith("the Node majors differ", ".forgejo/workflows/pdf.yaml:6  26 (26)", `${CI}:10  24 (24)`);
});

for (const at of [2, 4, 6]) {
    test(`fails on the Dockerfile stage on line ${at}`, () => {
        const f = fixture();
        f.setLine("Dockerfile", at, dockerLines[at - 1].replace("node:24", "node:26"));
        f.failsWith("the Node majors differ", `Dockerfile:${at}  26 (`, `${CI}:10  24 (24)`);
    });
}

test("fails on a node image on the continued line of a FROM", () => {
    const f = fixture();
    f.setLine("Dockerfile", 6, "FROM \\\n  node:26-alpine AS runtime");
    f.failsWith("the Node majors differ", "Dockerfile:6  26 (node:26-alpine)");
});

test("fails on a FROM after a comment line that ends in a backslash", () => {
    const f = fixture();
    f.setLine("Dockerfile", 3, "# a comment \\\nFROM node:26");
    f.failsWith("the Node majors differ", "Dockerfile:4  26 (node:26)");
});

test("fails on a FROM after heredocs, whatever their end words", () => {
    const f = fixture();
    f.setLine("Dockerfile", 3, "RUN <<EOF-END\necho ok\nEOF-END\nFROM node:26\nRUN <<EOF\necho ok\nEOF");
    f.failsWith("the Node majors differ", "Dockerfile:6  26 (node:26)");
});

// Known limit, failing closed: the check reads a heredoc body like any other
// line rather than risk skipping a real stage (see the script header).
test("fails on a heredoc body line that starts with FROM node:<tag>", () => {
    const f = fixture();
    f.setLine("Dockerfile", 3, "RUN <<EOF\nFROM node:26\nEOF");
    f.failsWith("the Node majors differ", "Dockerfile:4  26 (node:26)");
});

// #138 at f645318, the head when #140 was filed: CI and the Dockerfile at 26.
test("fails on engines.node left behind", () => {
    const f = fixture();
    f.setMajor("26");
    f.writePackage({ engines: { node: "24.x" } });
    f.failsWith("the Node majors differ", "package.json engines.node  24 (24.x)", `${CI}:10  26 (26)`);
});

test("fails on @types/node", () => {
    const f = fixture();
    f.writePackage({ engines: { node: "24.x" }, devDependencies: { "@types/node": "^26.0.0" } });
    f.failsWith(
        "the Node majors differ",
        "package.json devDependencies @types/node  26 (^26.0.0)",
        "package.json engines.node  24 (24.x)",
    );
});

test("fails on an @types/node of dependencies that differs from the one of devDependencies", () => {
    const f = fixture();
    f.writePackage({
        engines: { node: "24.x" },
        devDependencies: { "@types/node": "^24.12.4" },
        dependencies: { "@types/node": "^26.0.0" },
    });
    f.failsWith(
        "the Node majors differ",
        "package.json dependencies @types/node  26 (^26.0.0)",
        "package.json devDependencies @types/node  24 (^24.12.4)",
    );
});

// Fails when it cannot read a pin.

for (const file of [CI, "Dockerfile", "package.json"]) {
    test(`fails on a ${file} that is gone`, () => {
        const f = fixture();
        renameSync(path.join(f.dir, file), path.join(f.dir, `${file}.old`));
        f.failsWith(file === CI ? ".forgejo/workflows has no workflow file" : `${file} not found`);
    });
}

test("fails on a repo without .forgejo/workflows", () => {
    const f = fixture();
    rmSync(path.join(f.dir, ".forgejo"), { recursive: true });
    f.failsWith(".forgejo/workflows not found");
});

for (const [step, input] of [
    [8, 10],
    [15, 20],
    [28, 30],
]) {
    test(`fails on the setup-node step on line ${step} without its node-version`, () => {
        const f = fixture();
        f.setLine(CI, input, "");
        f.failsWith(`${CI}:${step} actions/setup-node step has no node-version`);
    });
}

test("fails on a setup-node step that reads node-version-file", () => {
    const f = fixture();
    f.setLine(CI, 10, "          node-version-file: .nvmrc");
    f.failsWith(`${CI}:8 actions/setup-node step has no node-version (node-version-file is not read)`);
});

test("fails on a node-version under the step's env: instead of with:", () => {
    const f = fixture();
    f.setLine(CI, 9, "        env:");
    f.failsWith(
        `${CI}:8 actions/setup-node step has no node-version`,
        `${CI}:10 node-version is not in an actions/setup-node step`,
    );
});

for (const key of ['"node-version"', "'node-version'"]) {
    test(`fails on a quoted ${key} key under the step's env: instead of with:`, () => {
        const f = fixture();
        f.setLine(CI, 9, "        env:");
        f.setLine(CI, 10, `          ${key}: 24`);
        f.failsWith(
            `${CI}:8 actions/setup-node step has no node-version`,
            `${CI}:10 node-version is not in an actions/setup-node step`,
        );
    });
}

for (const [name, keys] of [
    ["a plain key then a quoted one", ["node-version: 24", '"node-version": 26']],
    ["a quoted key then a plain one", ["'node-version': 24", "node-version: 26"]],
]) {
    test(`fails on a second node-version in one with:, ${name}`, () => {
        const f = fixture();
        f.setLine(CI, 10, keys.map((k) => `          ${k}`).join("\n"));
        f.failsWith(`${CI}:11 node-version is not in an actions/setup-node step`);
    });
}

test('fails on a setup-node step whose only input is a quoted "node-version-file"', () => {
    const f = fixture();
    f.setLine(CI, 10, '          "node-version-file": .nvmrc');
    f.failsWith(`${CI}:8 actions/setup-node step has no node-version (node-version-file is not read)`);
});

// A key opened with one quote and closed with the other is a string left open.
for (const key of [`"node-version'`, `'node-version"`]) {
    test(`fails on a node-version key quoted as ${key}`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          ${key}: 24`);
        f.failsWith(`${CI}:10 leaves a quoted string open onto the next line, which this check cannot read`);
    });
}

test("fails on a node-version outside any setup-node step", () => {
    const f = fixture();
    f.setLine(CI, 7, `${ciLines[6]}\n        with:\n          node-version: 24`);
    f.failsWith(`${CI}:9 node-version is not in an actions/setup-node step`);
});

test("fails on workflows with no setup-node step", () => {
    const f = fixture();
    f.write(CI, files[CI].replaceAll("actions/setup-node@", "actions/other@"));
    f.failsWith(".forgejo/workflows has no actions/setup-node step");
});

for (const value of ["lts/*", "latest", "node", ">=24", "24 || 26"]) {
    test(`fails on a node-version of ${value}, which names no one major`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          node-version: ${value}`);
        f.failsWith(`${CI}:10 node-version '${value}' does not name one Node major`);
    });
}

for (const [value, read] of [
    ['"24#oops"', "24#oops"],
    ["24#oops", "24#oops"],
    ['"24" x', '"24" x'],
]) {
    test(`fails on a node-version of ${value}, reading it as ${read}`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          node-version: ${value}`);
        f.failsWith(`${CI}:10 node-version '${read}' does not name one Node major`);
    });
}

test('fails on a node-version of "24, which leaves a quoted string open', () => {
    const f = fixture();
    f.setLine(CI, 10, '          node-version: "24');
    f.failsWith(`${CI}:10 leaves a quoted string open onto the next line, which this check cannot read`);
});

for (const [name, text] of [
    ["a flow mapping", "        with: { node-version: 24 }"],
    ["a flow mapping with a nested node-version", "        with: { ignored: { node-version: 24 }, node-version: 26 }"],
    ["a flow mapping over several lines", "        with: {\n          node-version: 24,\n          cache: npm\n        }"],
    ["an alias", "        with: *inputs"],
    ["an anchor then an alias", "        with: &a *b"],
    ["a tag other than !!map", "        with: !!str"],
    ["an anchor with no name", "        with: & "],
    ["a block scalar", "        with: |\n          node-version: 24"],
]) {
    test(`fails on a setup-node step whose with: is ${name}`, () => {
        const f = fixture();
        f.setLine(CI, 10, "");
        f.setLine(CI, 9, text);
        f.failsWith(`${CI}:9 actions/setup-node step does not write with: as a block mapping`);
    });
}

test("fails on a setup-node step after a block scalar body, which ends at the dash column", () => {
    const f = fixture();
    f.setLine(CI, 11, "      - run: |\n          echo hi\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 26");
    f.failsWith("the Node majors differ", `${CI}:15  26 (26)`);
});

test("fails on a job after a key whose comment ends in `: |`, which starts no block scalar", () => {
    const f = fixture();
    f.setLine(
        CI,
        30,
        `${ciLines[29]}\n  hidden: # note: |\n    steps:\n      - uses: actions/setup-node@v7\n        with:\n          node-version: 26`,
    );
    f.failsWith("the Node majors differ", `${CI}:35  26 (26)`);
});

// #151: a with: or a node-version that YAML does not read as an input of the
// step, as the only step of a second job. On 8a041a0 the check read each as
// the step's pin and passed with "4 pins read Node 24", while a YAML parser
// reads the step with no node-version under its with.
const firstJob = ["on: push", "jobs:", "  a:", "    steps:", "      - uses: actions/setup-node@v7", "        with:", "          node-version: 24"];
function secondJob(f, step) {
    f.write(CI, `${[...firstJob, "  b:", "    steps:", "      - uses: actions/setup-node@v7", ...step].join("\n")}\n`);
    f.write("Dockerfile", "FROM node:24-alpine\n");
    f.writePackage({ engines: { node: "24.x" } });
}
const NOPIN = `${CI}:10 actions/setup-node step has no node-version`;
for (const [name, step, ...messages] of [
    ["A: a with: under another key of the step", ["        env:", "          with:", "            node-version: 24"], NOPIN, `${CI}:13 node-version is not in an actions/setup-node step`],
    ["B: a with: in the body of a block scalar that is a list item", ["        args:", "          - |", "            with:", "              node-version: 24"], NOPIN],
    ["C: a with: in the body of a block scalar whose key holds a blank", ["        my key: |", "          with:", "            node-version: 24"], NOPIN],
    ["D: a with: in the body of a block scalar after an anchor", ["        notes: &n |", "          with:", "            node-version: 24"], NOPIN],
    ["E: a with: in the body of a block scalar whose quoted key holds a blank", ['        "my key": |', "          with:", "            node-version: 24"], NOPIN],
    ["F: a node-version under another input of with:", ["        with:", "          foo:", "            node-version: 24"], NOPIN, `${CI}:13 node-version is not in an actions/setup-node step`],
    [
        "N: a setup-node uses: under a key of an open setup-node step",
        ["        env:", "          uses: actions/setup-node@v7", "          with:", "            node-version: 24"],
        NOPIN,
        `${CI}:12 names actions/setup-node@ under a key of another setup-node step, which this check cannot read`,
        `${CI}:14 node-version is not in an actions/setup-node step`,
    ],
]) {
    test(`fails on ${name}`, () => {
        const f = fixture();
        secondJob(f, step);
        f.failsWith(...messages);
    });
}

test("fails on form F beside a node-version: 26 input, reading the 26 as the step's pin", () => {
    const f = fixture();
    secondJob(f, ["        with:", "          foo:", "            node-version: 24", "          node-version: 26"]);
    const err = f.failsWith("the Node majors differ", `${CI}:14  26 (26)`, `${CI}:13 node-version is not in an actions/setup-node step`);
    assert.doesNotMatch(err, /:10 actions\/setup-node step has no node-version|:13 {2}24 /);
});

for (const step of ["{ uses: actions/setup-node@v7, with: { node-version: 26 } }", '{"uses": actions/setup-node@v7}', '{"uses":"actions/setup-node@v7"}']) {
    test(`fails on a setup-node step written as one flow mapping: ${step}`, () => {
        const f = fixture();
        f.setLine(CI, 8, `      - ${step}`);
        f.setLine(CI, 9, "");
        f.setLine(CI, 10, "");
        f.failsWith(`${CI}:8 actions/setup-node step is not written as a block mapping`);
    });
}

// A line that names the action outside a uses: this check opens a step on
// fails, even when it is text, rather than risk a step that goes unread.
for (const [name, text, at] of [
    ["an action on the line after its uses:", "      - uses:\n          actions/setup-node@v7", 9],
    ["plain text", "      - run: echo uses: actions/setup-node@v7", 8],
    ["a quoted string", `      - run: 'echo "uses": actions/setup-node@v7'`, 8],
]) {
    test(`fails on a line that names actions/setup-node@ in ${name}`, () => {
        const f = fixture();
        f.setLine(CI, 8, text);
        f.failsWith(`${CI}:${at} actions/setup-node step is not written as a block mapping`);
    });
}

for (const header of ["- uses: >-", "- uses: |", '- "uses": |-']) {
    test(`fails on a uses: that names its action in a block scalar: ${header}`, () => {
        const f = fixture();
        f.setLine(CI, 8, `      ${header}\n          actions/setup-node@v7`);
        f.failsWith(`${CI}:8 uses: names its action in a block scalar (| or >), which this check cannot read`);
    });
}

// #151: an anchor or a tag may come before the indicator or the key, and the
// key is read in any letter case, as the rule that opens a step reads it.
for (const header of ["- uses: &a |", "- &a uses: >-", "- !!str uses: |", "- Uses: >-"]) {
    test(`fails on a uses: block scalar after an anchor or a tag, or in another letter case: ${header}`, () => {
        const f = fixture();
        f.setLine(CI, 8, `      ${header}\n          actions/setup-node@v7`);
        f.failsWith(`${CI}:8 uses: names its action in a block scalar (| or >), which this check cannot read`);
    });
}

// A block scalar header on a line of its own belongs to the key on the line
// before, and its body may sit shallower than the header, so this reader
// cannot tell where the body ends (#151).
for (const [name, text] of [
    ["under a key", "      - run:\n          |\n          npm ci"],
    ["after an anchor, under a key", "      - run: &cmd\n          >-\n          npm ci"],
]) {
    test(`fails on a block scalar header with no key and no dash on its line, ${name}`, () => {
        const f = fixture();
        f.setLine(CI, 11, text);
        f.failsWith(`${CI}:12 starts a block scalar (| or >) on a line with no key and no -, which this check cannot read`);
    });
}

// #151: Forgejo resolves an action in any letter case, so the step is read.
test("fails on a setup-node step that names the action in another letter case, reading its node-version", () => {
    const f = fixture();
    f.setLine(CI, 8, "      - uses: Actions/Setup-Node@v7");
    f.setLine(CI, 10, "          node-version: 26");
    f.failsWith("the Node majors differ", `${CI}:10  26 (26)`);
});

test("fails on a node-version in a flow mapping outside any setup-node step", () => {
    const f = fixture();
    f.setLine(CI, 5, "    env: { node-version: 26 }");
    f.failsWith(`${CI}:5 node-version is not in an actions/setup-node step`);
});

for (const env of ['{"node-version": 26}', "{'node-version': 26}"]) {
    test(`fails on a quoted node-version key in a flow mapping outside any setup-node step: ${env}`, () => {
        const f = fixture();
        f.setLine(CI, 5, `    env: ${env}`);
        f.failsWith(`${CI}:5 node-version is not in an actions/setup-node step`);
    });
}

test("fails on a node-version that is an expression", () => {
    const f = fixture();
    f.setLine(CI, 10, "          node-version: ${{ matrix.node }}");
    f.failsWith(`${CI}:10 node-version '\${{ matrix.node }}' is an expression`);
});

for (const [image, message] of [
    ["node:lts-alpine", "node tag 'lts-alpine' does not start with a Node major"],
    ["node:alpine", "node tag 'alpine' does not start with a Node major"],
    ["node", "node has no tag"],
    ["node@sha256:0123abcd", "node@sha256:0123abcd has no tag"],
]) {
    test(`fails on a Dockerfile stage FROM ${image}`, () => {
        const f = fixture();
        f.setLine("Dockerfile", 6, `FROM ${image}`);
        f.failsWith(`Dockerfile:6 ${message}`);
    });
}

for (const from of ["FROM ${IMG}", "FROM --platform=linux/amd64 ${IMG}"]) {
    test(`fails on a Dockerfile stage that takes its image from a build arg: ${from}`, () => {
        const f = fixture();
        f.setLine("Dockerfile", 6, `ARG IMG=node:24\n${from}`);
        f.failsWith("Dockerfile:7 FROM takes its image from a build arg");
    });
}

test("fails on a Dockerfile with no node stage", () => {
    const f = fixture();
    for (const at of [2, 4, 6]) f.setLine("Dockerfile", at, "FROM debian:bookworm-slim");
    f.failsWith("Dockerfile has no FROM node line");
});

test("fails on a package.json that is not JSON, without a stack trace", () => {
    const f = fixture();
    f.write("package.json", '{ "engines": { "node": "24.x", } }');
    assert.doesNotMatch(f.failsWith("package.json is not valid JSON"), /SyntaxError/);
});

for (const [name, text] of [
    ["no engines", JSON.stringify({ name: "x" })],
    ["engines without node", JSON.stringify({ engines: { npm: "11.x" } })],
    ["a JSON null", "null"],
]) {
    test(`fails on a package.json with ${name}`, () => {
        const f = fixture();
        f.write("package.json", text);
        assert.doesNotMatch(f.failsWith("package.json has no engines.node"), /TypeError/);
    });
}

for (const range of [">=24", "^24 || ^26", "*", ">=24 <25"]) {
    test(`fails on engines.node ${range}, which pins no one major`, () => {
        const f = fixture();
        f.writePackage({ engines: { node: range } });
        f.failsWith(`package.json engines.node '${range}' does not pin one Node major`);
    });
}

for (const range of [">=24", "*", "latest"]) {
    test(`fails on @types/node ${range}, which pins no one major`, () => {
        const f = fixture();
        f.writePackage({ engines: { node: "24.x" }, devDependencies: { "@types/node": range } });
        f.failsWith(`package.json devDependencies @types/node '${range}' does not pin one Node major`);
    });
}

// Fails on a YAML form that can spell a key or a value as other text than
// the line shows (#144). A step or an input written with an escape, a tag,
// an alias or an explicit key is one the patterns of this check do not
// match, and a quoted string or a flow collection left open turns the next
// lines into text or nested data that the check would read as inputs.

for (const [name, at, text, message] of [
    ["an escape in uses:", 8, '      - uses: "actions/setup\\x2dnode@v7"', "holds an escape in a double-quoted string"],
    ["an escape in a uses key", 8, '      - "us\\x65s": actions/setup-node@v7', "holds an escape in a double-quoted string"],
    ["an escape after a quoted key and a colon with no blank", 8, '      - {"uses":"actions/setup\\x2dnode@v7"}', "holds an escape in a double-quoted string"],
    ["an escape in a node-version key", 10, '          "node\\x2dversion": 24', "holds an escape in a double-quoted string"],
    ["a !!binary uses:", 8, "      - uses: !!binary YWN0aW9ucy9zZXR1cC1ub2RlQHY3", "uses a YAML tag other than !!map"],
    ["a !!binary node-version key", 10, "          !!binary bm9kZS12ZXJzaW9u: 24", "uses a YAML tag other than !!map"],
    ["a !!str uses:", 8, "      - uses: !!str actions/setup-node@v7", "uses a YAML tag other than !!map"],
    ["a local tag on node-version", 10, "          node-version: !pin 24", "uses a YAML tag other than !!map"],
    ["a verbatim tag on uses:", 8, "      - uses: !<tag:yaml.org,2002:binary> YWN0aW9ucy9zZXR1cC1ub2RlQHY3", "uses a YAML tag other than !!map"],
    ["an explicit uses key", 8, "      - ? uses\n        : actions/setup-node@v7", "uses a YAML explicit key (?)"],
    ["an explicit node-version key", 10, "          ? node-version\n          : 24", "uses a YAML explicit key (?)"],
    ["a single-quoted value left open", 10, "          check-latest: 'true\n          node-version: 24\n          '", "leaves a quoted string open onto the next line"],
    ["a double-quoted value left open", 10, '          check-latest: "true\n          node-version: 24\n          "', "leaves a quoted string open onto the next line"],
    ["a flow mapping left open", 10, "          cache: {a: 1,\n          node-version: 24\n          }", "leaves a flow mapping or sequence open onto the next line"],
    ["a flow sequence left open", 10, "          cache: [a,\n          node-version: 24\n          ]", "leaves a flow mapping or sequence open onto the next line"],
]) {
    test(`fails on ${name}`, () => {
        const f = fixture();
        f.setLine(CI, at, text);
        f.failsWith(`${CI}:${at} ${message}, which this check cannot read`);
    });
}

test("fails on an alias as the action of uses:, and on the anchor that names the action", () => {
    const f = fixture();
    f.setLine(CI, 1, "name: &setup actions/setup-node@v7");
    f.setLine(CI, 8, "      - uses: *setup");
    f.failsWith(
        `${CI}:1 actions/setup-node step is not written as a block mapping`,
        `${CI}:8 uses a YAML alias, which this check cannot read`,
    );
});

test("fails on an alias as the node-version value", () => {
    const f = fixture();
    f.setLine(CI, 1, "name: &pin 26");
    f.setLine(CI, 10, "          node-version: *pin");
    f.failsWith(`${CI}:10 uses a YAML alias, which this check cannot read`);
});

test("fails on a !!binary uses: in a second workflow without another setup-node step", () => {
    const f = fixture();
    f.write(".forgejo/workflows/pdf.yaml", "jobs:\n  pdf:\n    steps:\n      - uses: !!binary YWN0aW9ucy9zZXR1cC1ub2RlQHY3\n");
    f.failsWith(".forgejo/workflows/pdf.yaml:4 uses a YAML tag other than !!map, which this check cannot read");
});

// Exits 2.

test("exits 2 on a directory that does not exist", () => {
    const { code, err } = fixture().run([path.join(base, "missing")]);
    assert.equal(code, 2);
    assert.match(err, /no directory/);
});

test("exits 2 on two arguments", () => {
    const f = fixture();
    const { code, err } = f.run([f.dir, f.dir]);
    assert.equal(code, 2);
    assert.match(err, /usage:/);
});

test("exits 2 without node on PATH", () => {
    // A PATH holding bash alone, for the script's `#!/usr/bin/env bash`.
    const f = fixture();
    const bin = path.join(f.dir, "bin");
    mkdirSync(bin);
    symlinkSync(execFileSync("bash", ["-c", "command -v bash"], { encoding: "utf8" }).trim(), path.join(bin, "bash"));
    const { code, err } = f.run([f.dir], { PATH: bin });
    assert.equal(code, 2);
    assert.match(err, /needs node on PATH/);
});

// The script holds three programs in single quotes: the awk workflow reader,
// the awk Dockerfile reader and the node package.json reader. An apostrophe
// in one, in a comment too, ends that quoting. One alone leaves bash a
// syntax error at a later line, which names neither the apostrophe nor its
// line; a pair splices shell text into the program, which may then fail
// nowhere. The
// workflow reader spells a quote as `q`.
for (const [name, opening, closing] of [
    ["awk workflow reader", `awk -v q="'" '`, `  ' "$ROOT/$rel")`],
    ["awk Dockerfile reader", "    awk '", `    ' "$file" |`],
    ["node package.json reader", "node -e '", "  ') || {"],
]) {
    test(`holds no apostrophe inside its single-quoted ${name}`, () => {
        const lines = readFileSync(scriptPath, "utf8").split("\n");
        const start = lines.findIndex((line) => line.endsWith(opening));
        const end = lines.findIndex((line, i) => i > start && line.startsWith(closing));
        // An apostrophe on the opening or closing line moves its quote, so
        // that line no longer matches.
        assert.ok(start > -1, `a line ending in ${opening}`);
        assert.ok(end > start, `a line after it starting with ${closing.trim()}`);
        const stray = lines.slice(start + 1, end).flatMap((line, i) => (line.includes("'") ? [`line ${start + i + 2}: ${line.trim()}`] : []));
        assert.deepEqual(stray, [], "write these without an apostrophe");
    });
}

// The check reads workflows with an awk line reader, since CI runs it before
// `npm ci`; each gap in that reader was found by hand (#144, #146, #151).
// Here a YAML parser reads the same workflows (#151, ported from sutom's
// check). Each case writes one entry of the fixture's setup-node steps in one
// YAML form (or a whole step, or a step it adds), and parses the result with
// eemeli/yaml, which resolves << merge keys as go-yaml does for Forgejo. The
// check may refuse any case (exit 1). It must never exit 0 on one in which
// the parser finds a setup-node step whose with: holds no node-version input
// that names the fixture's major, 24.

const pad = (n) => " ".repeat(n);
const hex = (s) => `\\x${s.charCodeAt(0).toString(16).padStart(2, "0")}`;

// An entry is [key, value], where the value is a scalar (a string) or the
// entries of a block mapping. A form writes one entry whose key sits at
// column `at` as lines, or returns null when it does not apply to that
// entry. An item form writes a whole step as the lines of a list item whose
// dash sits at column `dash`.
function block([key, value], at, writtenKey = key) {
    return typeof value === "string" ? [`${pad(at)}${writtenKey}: ${value}`] : [`${pad(at)}${writtenKey}:`, ...value.flatMap((entry) => block(entry, at + 2))];
}

function flow(entries) {
    return `{ ${entries.map(([k, v]) => `${k}: ${typeof v === "string" ? v : flow(v)}`).join(", ")} }`;
}

// The lines after a { that ends the line of a key or a dash at column `at`:
// one entry a line, deeper than the key, as eemeli/yaml requires, then the }.
function flowLines(entries, at) {
    return [...entries.map(([k, v]) => `${pad(at + 4)}${k}: ${typeof v === "string" ? v : flow(v)},`), `${pad(at + 2)}}`];
}

function json(entries) {
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${typeof v === "string" ? JSON.stringify(v) : json(v)}`).join(",")}}`;
}

// A form that applies to scalar entries only, or to block mappings only.
const scalarOnly =
    (write) =>
    ([key, value], at) =>
        typeof value === "string" ? write(key, value, at) : null;
const mappingOnly =
    (write) =>
    ([key, value], at) =>
        typeof value === "string" ? null : write(key, value, at);
// The block lines of an entry, with `text` (an anchor or a tag) written
// after its key.
const afterKey = (entry, at, text) => {
    const [first, ...rest] = block(entry, at);
    return [first.replace(/:( |$)/, `: ${text}$1`), ...rest];
};

const forms = [
    ["plain", (entry, at) => block(entry, at)],
    ["a double-quoted key", (entry, at) => block(entry, at, `"${entry[0]}"`)],
    ["a single-quoted key", (entry, at) => block(entry, at, `'${entry[0]}'`)],
    ["a double-quoted value", scalarOnly((k, v, at) => [`${pad(at)}${k}: "${v}"`])],
    ["a single-quoted value", scalarOnly((k, v, at) => [`${pad(at)}${k}: '${v}'`])],
    [
        "a comment after it",
        (entry, at) => {
            const [first, ...rest] = block(entry, at);
            return [`${first} # node-version: 26 uses: actions/setup-node@v7`, ...rest];
        },
    ],
    ["a comment line before it", (entry, at) => [`${pad(at)}# with: { node-version: 26 }`, ...block(entry, at)]],
    ["the !!str tag", scalarOnly((k, v, at) => [`${pad(at)}${k}: !!str ${v}`])],
    ["the !!map tag", mappingOnly((k, v, at) => afterKey([k, v], at, "!!map"))],
    ["the !!binary tag", scalarOnly((k, v, at) => [`${pad(at)}${k}: !!binary ${btoa(v)}`])],
    ["a local tag", (entry, at) => afterKey(entry, at, "!pin")],
    ["an anchor on the value", (entry, at) => afterKey(entry, at, "&v")],
    ["an anchor on the key", (entry, at) => block(entry, at, `&k ${entry[0]}`)],
    ["an alias of an anchor on another key", ([k, v], at) => [...afterKey([`x-${k}`, v], at, "&v"), `${pad(at)}${k}: *v`]],
    ["a merge key", mappingOnly((k, v, at) => [`${pad(at)}${k}:`, `${pad(at + 2)}<<: ${flow(v)}`])],
    ["a flow mapping", mappingOnly((k, v, at) => [`${pad(at)}${k}: ${flow(v)}`])],
    ["a JSON-style flow mapping", mappingOnly((k, v, at) => [`${pad(at)}${k}: ${json(v)}`])],
    ["a flow mapping over several lines", mappingOnly((k, v, at) => [`${pad(at)}${k}: {`, ...flowLines(v, at)])],
    ["a flow sequence", scalarOnly((k, v, at) => [`${pad(at)}${k}: [${v}]`])],
    ["a literal block scalar", scalarOnly((k, v, at) => [`${pad(at)}${k}: |-`, `${pad(at + 2)}${v}`])],
    ["a folded block scalar", scalarOnly((k, v, at) => [`${pad(at)}${k}: >-`, `${pad(at + 2)}${v}`])],
    ["a block scalar after an anchor", scalarOnly((k, v, at) => [`${pad(at)}${k}: &v |-`, `${pad(at + 2)}${v}`])],
    ["the value on the next line", scalarOnly((k, v, at) => [`${pad(at)}${k}:`, `${pad(at + 2)}${v}`])],
    ["a double-quoted value over two lines", scalarOnly((k, v, at) => [`${pad(at)}${k}: "${v}`, `${pad(at + 2)}"`])],
    // A block scalar header on the line after its key, with its body at the
    // column of the header: a mapping written there is text.
    [
        "a block scalar header on the line after its key",
        ([k, v], at) => (typeof v === "string" ? [`${pad(at)}${k}:`, `${pad(at + 2)}|-`, `${pad(at + 2)}${v}`] : [`${pad(at)}${k}:`, `${pad(at + 2)}|`, ...block([k, v], at).slice(1)]),
    ],
    [
        "a block scalar header on the line after its key and an anchor",
        ([k, v], at) => (typeof v === "string" ? [`${pad(at)}${k}: &v`, `${pad(at + 2)}>-`, `${pad(at + 2)}${v}`] : [`${pad(at)}${k}: &v`, `${pad(at + 2)}>`, ...block([k, v], at).slice(1)]),
    ],
    ["an escape in the key", (entry, at) => block(entry, at, `"${hex(entry[0])}${entry[0].slice(1)}"`)],
    ["an escape in the value", scalarOnly((k, v, at) => [`${pad(at)}${k}: "${hex(v)}${v.slice(1)}"`])],
    ["an explicit key", ([k, v], at) => (typeof v === "string" ? [`${pad(at)}? ${k}`, `${pad(at)}: ${v}`] : [`${pad(at)}? ${k}`, `${pad(at)}:`, ...block([k, v], at).slice(1)])],
    // #151's forms A to F: the entry under another key (A, and F when the
    // entry is node-version), or as text in the body of a block scalar (B
    // to E).
    ["under another key", (entry, at) => [`${pad(at)}other:`, ...block(entry, at + 2)]],
    ["under another key, after a key of its own", (entry, at) => [`${pad(at)}other:`, `${pad(at + 2)}x: 1`, ...block(entry, at + 2)]],
    ["in a flow mapping under another key", (entry, at) => [`${pad(at)}other: ${flow([entry])}`]],
    ["in the body of a block scalar that is a list item", (entry, at) => [`${pad(at)}args:`, `${pad(at + 2)}- |`, ...block(entry, at + 4)]],
    ["in the body of a block scalar whose key holds a blank", (entry, at) => [`${pad(at)}my key: |`, ...block(entry, at + 2)]],
    ["in the body of a block scalar after an anchor", (entry, at) => [`${pad(at)}notes: &n |`, ...block(entry, at + 2)]],
    ["in the body of a block scalar whose quoted key holds a blank", (entry, at) => [`${pad(at)}"my key": |`, ...block(entry, at + 2)]],
    // #151's form N: the entry in a setup-node step nested in another value,
    // which YAML reads as no step. A second uses: there would be a duplicate
    // key.
    [
        "under another key, beside a uses: of setup-node",
        (entry, at) => (entry[0] === "uses" ? null : [`${pad(at)}other:`, `${pad(at + 2)}uses: actions/setup-node@v7`, ...block(entry, at + 2)]),
    ],
    [
        "in a setup-node step in a list under another key",
        (entry, at) => (entry[0] === "uses" ? null : [`${pad(at)}args:`, `${pad(at + 2)}- uses: actions/setup-node@v7`, ...block(entry, at + 4)]),
    ],
];

const itemForms = [
    ["a flow mapping", (entries, dash) => [`${pad(dash)}- ${flow(entries)}`]],
    ["a JSON-style flow mapping", (entries, dash) => [`${pad(dash)}- ${json(entries)}`]],
    ["a JSON-style flow mapping with its dashes escaped", (entries, dash) => [`${pad(dash)}- ${json(entries).replaceAll("-", "\\x2d")}`]],
    ["a flow mapping over several lines", (entries, dash) => [`${pad(dash)}- {`, ...flowLines(entries, dash)]],
    ["an anchor on the item", (entries, dash) => [`${pad(dash)}- &step`, ...entries.flatMap((e) => block(e, dash + 2))]],
    ["the !!map tag on the item", (entries, dash) => [`${pad(dash)}- !!map`, ...entries.flatMap((e) => block(e, dash + 2))]],
    ["a lone dash", (entries, dash) => [`${pad(dash)}-`, ...entries.flatMap((e) => block(e, dash + 2))]],
    ["a merge key", (entries, dash) => [`${pad(dash)}- <<: ${flow(entries)}`]],
];

// The lines of a list item whose keys sit at column dash + 2, with the dash
// on its first line that is no comment.
function dashed(lines, dash) {
    const first = lines.findIndex((line) => !/^\s*#/.test(line));
    return lines.map((line, i) => (i === first ? `${pad(dash)}- ${line.slice(dash + 2)}` : line));
}

// The fixture's setup-node steps: the first line of the item, the column of
// its dash, the lines of its uses: and with:, the entries the item forms
// write before uses: (they leave out step c's env:, a list), the action, and
// the inputs by line. The last input, node-version, is on the last line of
// the step.
const NV = "node-version";
const steps = [
    { item: 8, dash: 6, uses: 8, with: 9, entries: [], action: "actions/setup-node@v7", inputs: [[10, [NV, "24"]]] },
    {
        item: 14,
        dash: 6,
        uses: 15,
        with: 16,
        entries: [["name", "Set up Node"]],
        action: "actions/setup-node@v7",
        inputs: [
            [19, ["cache", "npm"]],
            [20, [NV, "24.x"]],
        ],
    },
    { item: 24, dash: 4, uses: 28, with: 29, entries: [["name", "Set up Node"]], action: "https://data.forgejo.org/actions/setup-node@v7", inputs: [[30, [NV, "24.12.0"]]] },
];

// The fixture's ci.yml with line `at` (1-based) replaced by edits[at], which
// may hold no line or several.
function edited(edits) {
    return `${ciLines.flatMap((line, i) => edits[i + 1] ?? [line]).join("\n")}\n`;
}

// Lines `from` to `to` replaced by `lines`.
function replaced(from, to, lines) {
    const edits = { [from]: lines };
    for (let at = from + 1; at <= to; at++) edits[at] = [];
    return edits;
}

// The node-version input of an entry list set to 26, or nested under extra:.
const at26 = (inputs) => inputs.map((e) => (e[0] === NV ? [NV, "26"] : e));
const nestedNv = (inputs) => inputs.map((e) => (e[0] === NV ? ["extra", [e]] : e));

// A setup-node step that names no Node 24, added after step a (line 10), in
// the fixture's layout: `- ` at column 6.
const addedStep = (lines) => edited({ 10: [ciLines[9], ...dashed(lines, 6)] });
const ADDED = "a setup-node step added after line 10 that names no Node 24";
const addedUses = ["uses", "actions/setup-node@v7"];

const cases = [{ name: "the unmodified fixture", form: "none", text: files[CI] }];
function addCase(form, where, text) {
    if (text !== null) cases.push({ name: `${form}: ${where}`, form, text });
}

for (const [name, form] of forms) {
    for (const step of steps) {
        // The keys of the step sit two columns right of its dash, and its
        // inputs two more.
        const keys = step.dash + 2;
        const inputAt = keys + 2;
        const inputs = step.inputs.map(([, input]) => input);
        const [last, [, nv]] = step.inputs.at(-1);
        // The uses:, a line added to the step before its with:, and each
        // input but node-version, each as it is and with the node-version of
        // the step nested under extra:, where the parser reads a violation.
        const nesting = { [last]: [`${pad(inputAt)}extra:`, `${pad(inputAt + 2)}${NV}: ${nv}`] };
        for (const [variant, edits] of [
            ["", {}],
            [`, with ${NV} nested under extra:`, nesting],
        ]) {
            const uses = form(["uses", step.action], keys);
            const usesLines = uses && (step.uses === step.item ? dashed(uses, step.dash) : uses);
            addCase(name, `the uses: on line ${step.uses}${variant}`, usesLines && edited({ ...edits, [step.uses]: usesLines }));
            const id = form(["id", "setup"], keys);
            addCase(name, `a line added after line ${step.uses}${variant}`, id && edited({ ...edits, [step.uses]: [ciLines[step.uses - 1], ...id] }));
            for (const [line, input] of step.inputs.slice(0, -1)) {
                const lines = form(input, inputAt);
                addCase(name, `the input on line ${line}${variant}`, lines && edited({ ...edits, [line]: lines }));
            }
        }
        // The with: block as it is, with node-version: 26, and with
        // node-version nested under extra:.
        const withBlock = (written) => {
            const lines = form(["with", written], keys);
            return lines && edited(replaced(step.with, last, lines));
        };
        addCase(name, `the with: on line ${step.with}`, withBlock(inputs));
        addCase(name, `the with: on line ${step.with}, with ${NV}: 26`, withBlock(at26(inputs)));
        addCase(name, `the with: on line ${step.with}, with ${NV} nested under extra:`, withBlock(nestedNv(inputs)));
        // The node-version input as it is, set to 26, and nested under extra:.
        const input = form([NV, nv], inputAt);
        addCase(name, `the input on line ${last}`, input && edited({ [last]: input }));
        const pin = form([NV, "26"], inputAt);
        addCase(name, `the input on line ${last}, set to 26`, pin && edited({ [last]: pin }));
        const nested = form([NV, nv], inputAt + 2);
        addCase(name, `the input on line ${last}, nested under extra:`, nested && edited({ [last]: [`${pad(inputAt)}extra:`, ...nested] }));
    }
    const uses = form(addedUses, 8);
    addCase(name, `the uses: of ${ADDED}`, uses && addedStep([...uses, ...block(["with", [["cache", "npm"]]], 8)]));
    const inputs = form(["with", [["cache", "npm"]]], 8);
    addCase(name, `the with: of ${ADDED}`, inputs && addedStep([...block(addedUses, 8), ...inputs]));
    const input = form([NV, "26"], 10);
    addCase(name, `the input of ${ADDED}`, input && addedStep([...block(addedUses, 8), "        with:", ...input]));
}

for (const [name, form] of itemForms) {
    const item = `the step as ${name}`;
    for (const step of steps) {
        const inputs = step.inputs.map(([, input]) => input);
        const last = step.inputs.at(-1)[0];
        const write = (written) => edited(replaced(step.item, last, form([...step.entries, ["uses", step.action], ["with", written]], step.dash)));
        addCase(item, `on line ${step.item}`, write(inputs));
        addCase(item, `on line ${step.item}, with ${NV}: 26`, write(at26(inputs)));
    }
    addCase(item, ADDED, edited({ 10: [ciLines[9], ...form([addedUses, ["with", [["cache", "npm"]]]], 6)] }));
}

// A node-version that names Node 24 as setup-node reads it: 24, v24, 24.x,
// 24.12.0. It is written apart from the script's ONE_MAJOR, so a gap in that
// pattern does not show up here as well.
const NAMES_24 = /^v?24(\.([0-9]+|x)){0,2}$/;

// The setup-node steps the parser reads whose with: holds no node-version
// that names Node 24, as `<job> step <n>`. A !!binary scalar is bytes here,
// which go-yaml hands Forgejo as text, so it is read as text, and a plain 24
// is a number. A workflow the parser rejects throws: the generator wrote no
// YAML.
function parserViolations(text) {
    const doc = parseDocument(text, { merge: true });
    if (doc.errors.length > 0) throw new Error(`the parser rejects this case: ${doc.errors[0].message}\n${text}`);
    const asText = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : v instanceof Uint8Array ? new TextDecoder().decode(v) : undefined);
    const get = (node, key) => (node instanceof Map ? [...node].find(([k]) => asText(k) === key)?.[1] : undefined);
    const violations = [];
    const jobs = get(doc.toJS({ mapAsMap: true }), "jobs");
    for (const [job, body] of jobs instanceof Map ? jobs : []) {
        const jobSteps = get(body, "steps");
        (Array.isArray(jobSteps) ? jobSteps : []).forEach((step, i) => {
            const uses = asText(get(step, "uses"))?.toLowerCase();
            if (uses === undefined || !/^(.*\/)?actions\/setup-node@/.test(uses)) return;
            const version = asText(get(get(step, "with"), NV));
            if (!NAMES_24.test(version ?? "")) violations.push(`${asText(job)} step ${i + 1}`);
        });
    }
    return violations;
}

// Run the check without blocking, so the cases run side by side. A run still
// going after 30 s is stuck: killed, it exits with no code.
function runAsync(dir) {
    return new Promise((resolve) => {
        execFile(scriptPath, [dir], { encoding: "utf8", timeout: 30_000 }, (error, out, err) => {
            const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;
            resolve({ code, out, err });
        });
    });
}

test("compared with a YAML parser, reads the unmodified fixture as the parser does: no step names another major", () => {
    assert.deepEqual(parserViolations(files[CI]), []);
    fixture().passesWith(ALL);
});

test("compared with a YAML parser, generates for every form a case the parser reads as a violation, each under its own name", () => {
    const names = [...forms.map(([name]) => name), ...itemForms.map(([name]) => `the step as ${name}`)];
    const found = new Set(cases.filter((c) => parserViolations(c.text).length > 0).map((c) => c.form));
    assert.deepEqual(
        names.filter((name) => !found.has(name)),
        [],
    );
    assert.equal(new Set(cases.map((c) => c.name)).size, cases.length);
});

// Each case runs in its own directory, so the cases run side by side.
describe("compared with a YAML parser, never passes a case the parser reads as a violation", { concurrency: availableParallelism() }, () => {
    for (const { name, text } of cases) {
        test(name, async () => {
            const violations = parserViolations(text);
            const f = fixture();
            f.write(CI, text);
            const { code, out, err } = await runAsync(f.dir);
            assert.ok(code === 0 || code === 1, `check-node-pins.sh exited ${code}:\n${out}${err}`);
            if (code === 0) assert.deepEqual(violations, [], `check-node-pins.sh passed on\n${text}`);
        });
    }
});
