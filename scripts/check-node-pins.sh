#!/usr/bin/env bash
# Check that CI, the production image and package.json pin one Node major
# (#140). CI runs this script before `npm ci`, so a local run runs the same
# check.
#
#   scripts/check-node-pins.sh [<repo dir>]
#
# It reads each pin from the file that sets it:
#   .forgejo/workflows/*.yml and *.yaml  the major of the `node-version`
#     input (24 out of 24, 24.x or 24.12.0) of every actions/setup-node step,
#     the Node CI runs. A step without one, a value such as lts/* or
#     ${{ matrix.node }}, and a `node-version` outside such a step fail; a
#     `node-version-file` input is not read.
#   Dockerfile  the major of the tag of every `FROM [<registry>/]node:<tag>`
#     (24 out of 24-alpine or 24.12.0-alpine@sha256:...), the Node that
#     Coolify builds production on. A FROM continued over several lines is
#     read whole, and a FROM that names an earlier stage is skipped. The
#     body of a heredoc (RUN <<EOF) is read like any other line, so a body
#     line that starts with FROM node:<tag> counts as a stage: skipping
#     bodies would take BuildKit's shell tokenizer, and any way this script
#     read a heredoc differently would let a real stage go unread.
#   package.json  the major of `engines.node` (24 out of 24.x), and of the
#     `@types/node` range in devDependencies or dependencies when the repo
#     has one (none today).
# The Node.js group in renovate.json moves them together. The dev shell's
# Node comes from flake.nix, which Renovate does not update, so a
# `node --version` with another major prints a warning only.
# Exit 0: every pin reads the same major. Exit 1: the pins differ or one
# cannot be read, and the output names each file, line and value. Exit 2: a
# wrong call, a <repo dir> that does not exist, or no node on PATH.
# test/check-node-pins.test.js runs it on edited copies of the three files,
# one failure class per test: add a test there when the parsing changes.
set -uo pipefail

if [ $# -gt 1 ]; then
  echo "usage: scripts/check-node-pins.sh [<repo dir>]" >&2
  exit 2
fi
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
if [ ! -d "$ROOT" ]; then
  echo "check-node-pins: no directory $ROOT" >&2
  exit 2
fi
# It parses package.json with node, so in CI it runs after setup-node.
if ! command -v node >/dev/null 2>&1; then
  echo "check-node-pins: needs node on PATH" >&2
  exit 2
fi

WORKFLOWS=.forgejo/workflows
DOCKERFILE=Dockerfile
PACKAGE=package.json

# One major, as a Node version or an npm range: 24, v24, 24.x, 24.12.0,
# ^24.12.4, ~24.1.0. A range that spans majors (>=24, ^24 || ^26) or names
# none (lts/*, *, latest) does not match. The pattern sits in a variable
# because bash drops the backslash of a `[\^~]` written inline, which turns
# the class into "not ~".
ONE_MAJOR='^[~^]?v?([0-9]+)(\.([0-9]+|x|\*)){0,2}(-[0-9A-Za-z.-]+)?$'

# One entry per pin: where it is, the major it reads, and the text it read.
where=()
major=()
shown=()
status=0

pin() {
  where+=("$1")
  major+=("$2")
  shown+=("$3")
}

fail() {
  echo "check-node-pins: $1" >&2
  status=1
}

# Read the node-version inputs of one workflow file.
read_workflow() {
  local rel="$1" kind line value
  while read -r kind line value; do
    case "$kind" in
      pin)
        steps=$((steps + 1))
        if [[ "$value" == *'${{'* ]]; then
          fail "$rel:$line node-version '$value' is an expression, which this check cannot read"
        elif [[ "$value" =~ $ONE_MAJOR ]]; then
          pin "$rel:$line" "${BASH_REMATCH[1]}" "$value"
        else
          fail "$rel:$line node-version '$value' does not name one Node major"
        fi
        ;;
      nopin)
        steps=$((steps + 1))
        fail "$rel:$line actions/setup-node step has no node-version (node-version-file is not read)"
        ;;
      stray) fail "$rel:$line node-version is not in an actions/setup-node step" ;;
    esac
  done < <(awk -v q="'" '
    function indent(s) { match(s, /^ */); return RLENGTH }
    function close_step() { if (open) print "nopin", open; open = 0; inwith = 0 }
    { sub(/\r$/, "") }
    /^[ \t]*(#|$)/ { next }
    {
      ind = indent($0)
      # A step ends at the next line indented no deeper than its `-`, and
      # its `with:` block at the next line indented no deeper than `with:`.
      if (open && ind <= step) close_step()
      if (inwith && ind <= withind) inwith = 0
      # A list item: remember its dash by the column its keys start at.
      if (match($0, /^ *- +/)) dash[RLENGTH] = ind
    }
    # actions/setup-node@<ref>, or a full URL to it.
    $0 ~ ("^[ \t-]*uses:[ \t]*[\"" q "]?([^ \t\"" q "]*/)?actions/setup-node@") {
      open = NR
      # `- uses:` opens the step; a bare `uses:` belongs to the item whose
      # keys start at its column.
      if ($0 ~ /^ *- /) step = ind
      else step = (ind in dash) ? dash[ind] : ind - 2
      next
    }
    open && /^[ \t]*with:[ \t]*(#.*)?$/ { inwith = 1; withind = ind; next }
    # Prints `pin <line> <value>` for the input of a setup-node step,
    # `nopin <line>` for a setup-node step without one, and `stray <line>`
    # for a node-version anywhere else (setup-node ignores one under env:).
    /^[ \t]*node-version:/ {
      v = $0
      sub(/^[ \t]*node-version:[ \t]*/, "", v)
      sub(/[ \t]*#.*$/, "", v)
      gsub(/"/, "", v)
      gsub(q, "", v)
      if (open && inwith) { print "pin", NR, v; open = 0; inwith = 0 } else print "stray", NR
    }
    END { close_step() }
  ' "$ROOT/$rel")
}

read_workflows() {
  local file found=0
  steps=0
  if [ ! -d "$ROOT/$WORKFLOWS" ]; then
    fail "$WORKFLOWS not found"
    return
  fi
  for file in "$ROOT/$WORKFLOWS"/*.yml "$ROOT/$WORKFLOWS"/*.yaml; do
    [ -f "$file" ] || continue
    found=1
    read_workflow "$WORKFLOWS/${file##*/}"
  done
  if [ "$found" -eq 0 ]; then
    fail "$WORKFLOWS has no workflow file"
  elif [ "$steps" -eq 0 ]; then
    fail "$WORKFLOWS has no actions/setup-node step"
  fi
}

# Names of the Dockerfile stages read so far, and whether one was a node
# image.
stages=()
found_node=0

# Read one FROM: its line number and image.
read_from() {
  local n="$1" image="$2" ref name last tag s
  # An image named by a build arg (FROM ${IMAGE}) hides its tag from this
  # check, so it fails instead of passing that stage unread.
  if [[ "$image" == *'$'* ]]; then
    fail "$DOCKERFILE:$n FROM takes its image from a build arg, which this check cannot read"
    return
  fi
  # FROM <earlier stage> builds on that stage, not on an image.
  for s in "${stages[@]}"; do
    if [ "${s,,}" = "${image,,}" ]; then return; fi
  done
  ref=${image%%@*}
  # The tag follows the last colon after the last slash, so a registry port
  # (localhost:5000/node) is not read as a tag.
  name=$ref
  tag=
  last=${ref##*/}
  if [[ "$last" == *:* ]]; then
    tag=${last#*:}
    name=${ref%:*}
  fi
  if [[ ! "$name" =~ (^|/)node$ ]]; then
    return
  fi
  found_node=1
  if [ -z "$tag" ]; then
    fail "$DOCKERFILE:$n $image has no tag"
  elif [[ "$tag" =~ ^([0-9]+)([.-]|$) ]]; then
    pin "$DOCKERFILE:$n" "${BASH_REMATCH[1]}" "$image"
  else
    fail "$DOCKERFILE:$n node tag '$tag' does not start with a Node major"
  fi
}

read_dockerfile() {
  local file="$ROOT/$DOCKERFILE" entry n i
  local -a words
  if [ ! -f "$file" ]; then
    fail "$DOCKERFILE not found"
    return
  fi
  while IFS= read -r entry; do
    n=${entry%%:*}
    entry=${entry#*:}
    read -ra words <<<"$entry"
    # Skip the flags (--platform=...) between FROM and the image.
    i=1
    while [[ "${words[i]:-}" == --* ]]; do i=$((i + 1)); done
    read_from "$n" "${words[i]:-}"
    # FROM <image> AS <name> names a stage that a later FROM may build on.
    if [[ "${words[i + 1]:-}" =~ ^[Aa][Ss]$ ]] && [ -n "${words[i + 2]:-}" ]; then
      stages+=("${words[i + 2]}")
    fi
  done < <(
    # One `<line>:<instruction>` per instruction, its continued lines
    # (ending in a backslash) joined, so `FROM \` does not hide the image on
    # the next line. Comment lines, and blank lines inside an instruction,
    # drop out as Docker drops them, so a comment that ends in a backslash
    # continues nothing.
    awk '
      { sub(/\r$/, "") }
      /^[ \t]*#/ { next }
      cont && /^[ \t]*$/ { next }
      { if (cont) buf = buf " " $0; else { buf = $0; start = NR } }
      /\\[ \t]*$/ { sub(/\\[ \t]*$/, "", buf); cont = 1; next }
      { cont = 0; print start ":" buf }
      END { if (cont) print start ":" buf }
    ' "$file" | grep -iE '^[0-9]+:[[:space:]]*FROM([[:space:]]|$)'
  )
  if [ "$found_node" -eq 0 ]; then
    fail "$DOCKERFILE has no FROM node line"
  fi
}

read_package() {
  local file="$ROOT/$PACKAGE" values engines types
  if [ ! -f "$file" ]; then
    fail "$PACKAGE not found"
    return
  fi
  # Two lines: engines.node, then @types/node, each empty when absent.
  values=$(PIN_FILE="$file" node -e '
    let pkg;
    try {
      pkg = JSON.parse(require("fs").readFileSync(process.env.PIN_FILE, "utf8"));
    } catch {
      process.exit(1);
    }
    const text = (v) => (typeof v === "string" ? v.replace(/\n/g, " ") : "");
    console.log(text(pkg?.engines?.node));
    console.log(text(pkg?.devDependencies?.["@types/node"] ?? pkg?.dependencies?.["@types/node"]));
  ') || {
    fail "$PACKAGE is not valid JSON"
    return
  }
  { IFS= read -r engines; IFS= read -r types; } <<<"$values"
  if [ -z "$engines" ]; then
    fail "$PACKAGE has no engines.node"
  elif [[ "$engines" =~ $ONE_MAJOR ]]; then
    pin "$PACKAGE engines.node" "${BASH_REMATCH[1]}" "$engines"
  else
    fail "$PACKAGE engines.node '$engines' does not pin one Node major"
  fi
  # @types/node is optional: the repo has no TypeScript today.
  if [ -z "$types" ]; then
    return
  elif [[ "$types" =~ $ONE_MAJOR ]]; then
    pin "$PACKAGE @types/node" "${BASH_REMATCH[1]}" "$types"
  else
    fail "$PACKAGE @types/node '$types' does not pin one Node major"
  fi
}

read_workflows
read_dockerfile
read_package

expected="${major[0]:-}"
differ=0
for v in "${major[@]}"; do
  if [ "$v" != "$expected" ]; then differ=1; fi
done

if [ "$differ" -eq 1 ] || [ "$status" -ne 0 ]; then
  if [ "$differ" -eq 1 ]; then echo "check-node-pins: the Node majors differ" >&2; fi
  for i in "${!where[@]}"; do
    printf '  %s  %s (%s)\n' "${where[$i]}" "${major[$i]}" "${shown[$i]}" >&2
  done
  exit 1
fi

list=$(printf ', %s' "${where[@]}")
echo "check-node-pins: ${#major[@]} pins read Node $expected (${list#, })"
running=$(node --version)
running=${running#v}
if [ "${running%%.*}" != "$expected" ]; then
  echo "check-node-pins: warning: this shell runs Node $running, not $expected." \
    "The dev shell's Node comes from flake.nix, which Renovate does not update." >&2
fi
