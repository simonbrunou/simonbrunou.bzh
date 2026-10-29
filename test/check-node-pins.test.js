// scripts/check-node-pins.sh (#140) against small pin files written per test,
// so every line number below is exact and no edit to the repo's own
// workflows, Dockerfile or package.json moves it. The fixture holds the
// shapes the script must read: three setup-node steps, three node stages, a
// FROM that builds on an earlier stage, a stage of another image and
// engines.node. A test edits one line into one failure class and asserts
// the exit code and the message that names the pin.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

test("passes on a second workflow without a setup-node step", () => {
    const f = fixture();
    f.write(".forgejo/workflows/pdf.yaml", "jobs:\n  pdf:\n    steps:\n      - run: echo pdf\n");
    f.passesWith(ALL);
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
    ['"24', '"24'],
    ['"24" x', '"24" x'],
]) {
    test(`fails on a node-version of ${value}, reading it as ${read}`, () => {
        const f = fixture();
        f.setLine(CI, 10, `          node-version: ${value}`);
        f.failsWith(`${CI}:10 node-version '${read}' does not name one Node major`);
    });
}

for (const [name, text] of [
    ["a flow mapping", "        with: { node-version: 24 }"],
    ["a flow mapping with a nested node-version", "        with: { ignored: { node-version: 24 }, node-version: 26 }"],
    ["a flow mapping over several lines", "        with: {\n          node-version: 24,\n          cache: npm\n        }"],
    ["an alias", "        with: *inputs"],
    ["an anchor then an alias", "        with: &a *b"],
    ["a tag other than !!map", "        with: !!str"],
    ["an anchor with no name", "        with: & "],
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

test("fails on a setup-node step written as one flow mapping", () => {
    const f = fixture();
    f.setLine(CI, 8, "      - { uses: actions/setup-node@v7, with: { node-version: 26 } }");
    f.setLine(CI, 9, "");
    f.setLine(CI, 10, "");
    f.failsWith(`${CI}:8 actions/setup-node step is not written as a block mapping`);
});

test("fails on a node-version in a flow mapping outside any setup-node step", () => {
    const f = fixture();
    f.setLine(CI, 5, "    env: { node-version: 26 }");
    f.failsWith(`${CI}:5 node-version is not in an actions/setup-node step`);
});

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
