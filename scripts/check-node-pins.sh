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
#     the Node CI runs. The step and its `with:` must be block mappings, as
#     in this repo's ci.yml (the `uses` key may be quoted, an anchor may name
#     the action, and an anchor or !!map may name the `with:`); the body of
#     a block scalar (run: |) is skipped.
#     A step without a node-version, a value such as lts/* or
#     ${{ matrix.node }}, a step or `with:` in flow style
#     (with: { node-version: 24 }), and a `node-version` outside such a step
#     fail; a `node-version-file` input is not read. Anywhere in a workflow
#     outside a comment and a block scalar body, the forms that can spell a
#     key or a value as other text than the line shows fail too, since
#     reading them would take a YAML parser: an escape in a double-quoted
#     string ("node\x2dversion"), an alias (*name), an explicit key (? ), a
#     tag other than !!map (!!binary decodes base64), and a quoted string or
#     a flow collection left open at the line end.
#   Dockerfile  the major of the tag of every `FROM [<registry>/]node:<tag>`
#     (24 out of 24-alpine or 24.12.0-alpine@sha256:...), the Node that
#     Coolify builds production on. A FROM continued over several lines is
#     read whole, and a FROM that names an earlier stage is skipped. The
#     body of a heredoc (RUN <<EOF) is read like any other line, so a body
#     line that starts with FROM node:<tag> counts as a stage: skipping
#     bodies would take BuildKit's shell tokenizer, and any way this script
#     read a heredoc differently would let a real stage go unread.
#   package.json  the major of `engines.node` (24 out of 24.x), and of each
#     `@types/node` range in devDependencies and dependencies when the repo
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
      unread)
        steps=$((steps + 1))
        fail "$rel:$line actions/setup-node step is not written as a block mapping, which this check cannot read"
        ;;
      flow)
        steps=$((steps + 1))
        fail "$rel:$line actions/setup-node step does not write with: as a block mapping, which this check cannot read"
        ;;
      escape) fail "$rel:$line holds an escape in a double-quoted string, which this check cannot read" ;;
      alias) fail "$rel:$line uses a YAML alias, which this check cannot read" ;;
      explicit) fail "$rel:$line uses a YAML explicit key (?), which this check cannot read" ;;
      tag) fail "$rel:$line uses a YAML tag other than !!map, which this check cannot read" ;;
      unclosed) fail "$rel:$line leaves a quoted string open onto the next line, which this check cannot read" ;;
      openflow) fail "$rel:$line leaves a flow mapping or sequence open onto the next line, which this check cannot read" ;;
    esac
  done < <(awk -v q="'" '
    BEGIN { body = -1 }
    function indent(s) { match(s, /^ */); return RLENGTH }
    function close_step() { if (open) print "nopin", open; open = 0; inwith = 0 }
    # The value of a YAML scalar: the text inside its quotes, or a plain
    # scalar up to a comment (a # after a blank). A quote that never closes,
    # or text after the closing quote, comes back as written, so it fails
    # the major pattern.
    function scalar(s,   c, i, rest) {
      sub(/^[ \t]+/, "", s)
      c = substr(s, 1, 1)
      if (c == "\"" || c == q) {
        i = index(substr(s, 2), c)
        if (!i) return s
        rest = substr(s, i + 2)
        if (rest !~ /^[ \t]*(#.*)?$/) return s
        return substr(s, 2, i - 1)
      }
      if (s ~ /^#/) return ""
      sub(/[ \t]+#.*$/, "", s)
      sub(/[ \t]+$/, "", s)
      return s
    }
    # Prints `pin <line> <value>` for the input of a setup-node step, and
    # `stray <line>` for a node-version anywhere else (setup-node ignores
    # one under env:).
    function input(v) {
      if (open && inwith) { print "pin", NR, v; open = 0; inwith = 0 } else print "stray", NR
    }
    # Read one line as YAML does, far enough to see the forms that spell a
    # key or a value as other text than the line shows: an escape in a
    # double-quoted string ("node\x2dversion"), an alias (*name), an
    # explicit key (? ) and a tag (!!binary). A quote, a *, a ! or a ? is
    # syntax only where a node starts: at the line start, after `- `, `? `
    # or `: `, after a tag or an anchor, and in a flow collection after [, {
    # or ,. Anywhere else, as in run: echo "a\b" or a double quote inside a
    # single-quoted string, it is text, and so is a comment (a # after a
    # blank). In a flow collection, a : right after a quoted scalar or a
    # closed collection starts a value even with no blank after it, as in
    # {"uses":"actions/setup-node@v7"}. Sets escape, alias, explicit, tag
    # (one other than !!map), unclosed for a quoted string still open at the
    # line end, and openflow for a flow collection.
    function scan(s,   n, i, j, c, nx, start, depth, inq, json, wasjson) {
      escape = 0; alias = 0; explicit = 0; tag = 0; unclosed = 0; openflow = 0
      n = length(s); start = 1; depth = 0; inq = ""; json = 0
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        nx = substr(s, i + 1, 1)
        if (inq != "") {
          if (inq == "\"" && c == "\\") { escape = 1; i++ }
          else if (c == inq && inq == q && nx == q) i++
          else if (c == inq) { inq = ""; json = 1 }
          continue
        }
        if (c == " " || c == "\t") continue
        if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[ \t]/)) {
          openflow = (depth > 0)
          return
        }
        wasjson = json; json = 0
        if (start) {
          if (c == "\"" || c == q) { inq = c; start = 0; continue }
          if ((c == "-" || c == "?") && (nx == "" || nx ~ /[ \t]/)) {
            if (c == "?") explicit = 1
            continue
          }
          if (c == "[" || c == "{") { depth++; continue }
          if (depth && (c == "]" || c == "}")) { depth--; start = 0; json = 1; continue }
          if (c == "!" || c == "&" || c == "*") {
            j = i
            while (i < n && substr(s, i + 1, 1) !~ /[] \t,{}[]/) i++
            if (c == "!" && substr(s, j, i - j + 1) != "!!map") tag = 1
            if (c == "*") { alias = 1; start = 0 }
            continue
          }
          # A plain scalar starts here.
          start = 0
        }
        if (c == ":" && (nx == "" || nx ~ /[ \t]/ || (depth && (wasjson || nx ~ /[],{}[]/)))) start = 1
        else if (depth && c == ",") start = 1
        else if (depth && (c == "]" || c == "}")) { depth--; json = 1 }
      }
      unclosed = (inq != "")
      openflow = (!unclosed && depth > 0)
    }
    { sub(/\r$/, "") }
    /^[ \t]*(#|$)/ { next }
    {
      ind = indent($0)
      # The body of a block scalar (run: |) is text, not YAML keys: it runs
      # until a line indented no deeper than its key.
      if (body >= 0) {
        if (ind > body) next
        body = -1
      }
      # A step ends at the next line indented no deeper than its `-`, and
      # its `with:` block at the next line indented no deeper than `with:`.
      if (open && ind <= step) close_step()
      if (inwith && ind <= withind) inwith = 0
      # A list item: remember its dash by the column its keys start at.
      if (match($0, /^ *- +/)) dash[RLENGTH] = ind
      # A key whose value is a block scalar (| or >) starts a body on the
      # next line, whatever rule below reads this one. The key is matched
      # from the start of the line, so a `: |` inside a comment
      # (hidden: # note: |) starts none.
      if ($0 ~ /^ *(- +)*[^ \t#:]+[ \t]*:[ \t]*[|>][-+0-9]*[ \t]*(#.*)?$/) {
        match($0, /^ *(- +)*/)
        body = RLENGTH
      }
      scan($0)
    }
    # actions/setup-node@<ref>, or a full URL to it, under a plain or quoted
    # uses key and after an optional anchor (uses: &setup actions/...).
    $0 ~ ("^[ \t-]*[\"" q "]?uses[\"" q "]?[ \t]*:[ \t]*(&[^ \t]+[ \t]+)?[\"" q "]?([^ \t\"" q "]*/)?actions/setup-node@") {
      open = NR
      # `- uses:` opens the step; a bare `uses:` belongs to the item whose
      # keys start at its column.
      if ($0 ~ /^ *- /) step = ind
      else step = (ind in dash) ? dash[ind] : ind - 2
      next
    }
    # Anything else that runs setup-node, such as a step written as one flow
    # mapping (- { uses: actions/setup-node@v7, ... }), prints `unread <line>`.
    $0 ~ ("uses[\"" q "]?[ \t]*:[ \t]*(&[^ \t,]+[ \t]+)?[\"" q "]?([^ \t\"" q ",]*/)?actions/setup-node@") {
      print "unread", NR
      next
    }
    # A block mapping of inputs, which an anchor (&inputs) or the mapping
    # tag (!!map) may name first.
    open && /^[ \t]*with[ \t]*:[ \t]*((&[^ \t#]+|!!map)([ \t]+(&[^ \t#]+|!!map))*)?[ \t]*(#.*)?$/ { inwith = 1; withind = ind; next }
    # Any other with: of a setup-node step ({ ... }, an alias, another tag)
    # prints `flow <line>`: reading those forms would take a YAML parser.
    open && /^[ \t]*with[ \t]*:/ { print "flow", NR; open = 0; next }
    # The patterns here would miss a node-version or a setup-node step
    # written with a form scan() flags, so each prints its kind, wherever in
    # the file it is. So does a quoted string or a flow collection that runs
    # onto the next line, whose next line this reader would read as keys.
    escape { print "escape", NR; next }
    alias { print "alias", NR; next }
    explicit { print "explicit", NR; next }
    tag { print "tag", NR; next }
    unclosed { print "unclosed", NR; next }
    openflow { print "openflow", NR; next }
    /^[ \t]*node-version[ \t]*:/ {
      v = $0
      sub(/^[ \t]*node-version[ \t]*:/, "", v)
      input(scalar(v))
      next
    }
    # A node-version key inside a flow mapping on any other line.
    /node-version[ \t]*:/ { print "stray", NR }
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
  local file="$ROOT/$PACKAGE" values engines key types i
  local -a lines
  if [ ! -f "$file" ]; then
    fail "$PACKAGE not found"
    return
  fi
  # Three lines: engines.node, then the @types/node of devDependencies and
  # of dependencies, each empty when absent.
  values=$(PIN_FILE="$file" node -e '
    let pkg;
    try {
      pkg = JSON.parse(require("fs").readFileSync(process.env.PIN_FILE, "utf8"));
    } catch {
      process.exit(1);
    }
    const text = (v) => (typeof v === "string" ? v.replace(/\n/g, " ") : "");
    console.log(text(pkg?.engines?.node));
    console.log(text(pkg?.devDependencies?.["@types/node"]));
    console.log(text(pkg?.dependencies?.["@types/node"]));
  ') || {
    fail "$PACKAGE is not valid JSON"
    return
  }
  # The command substitution drops trailing empty lines, hence the :- below.
  mapfile -t lines <<<"$values"
  engines=${lines[0]:-}
  if [ -z "$engines" ]; then
    fail "$PACKAGE has no engines.node"
  elif [[ "$engines" =~ $ONE_MAJOR ]]; then
    pin "$PACKAGE engines.node" "${BASH_REMATCH[1]}" "$engines"
  else
    fail "$PACKAGE engines.node '$engines' does not pin one Node major"
  fi
  i=1
  for key in devDependencies dependencies; do
    types=${lines[i]:-}
    i=$((i + 1))
    # @types/node is optional: the repo has no TypeScript today.
    if [ -z "$types" ]; then
      continue
    elif [[ "$types" =~ $ONE_MAJOR ]]; then
      pin "$PACKAGE $key @types/node" "${BASH_REMATCH[1]}" "$types"
    else
      fail "$PACKAGE $key @types/node '$types' does not pin one Node major"
    fi
  done
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
