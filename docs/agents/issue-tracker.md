# Issue tracker: Forgejo

Issues and specs for this repo live as Forgejo issues on `git.sbrn.eu/simonbrunou/simonbrunou.bzh` (the `origin` remote). The `github` remote is a push-disabled mirror. Never file issues there.

Use the [`fj`](https://codeberg.org/forgejo-contrib/forgejo-cli) CLI for everyday operations. Inside the clone it infers the repo from `origin`; pass `-R origin` if it picks the wrong remote. `fj` has no JSON output and no dependency command, so for those call the Forgejo REST API with the token `fj` already stores:

```sh
FJ_TOKEN=$(jq -r '.hosts["git.sbrn.eu"].token' ~/.local/share/forgejo-cli/keys.json)
API=https://git.sbrn.eu/api/v1/repos/simonbrunou/simonbrunou.bzh
curl -s -H "Authorization: token $FJ_TOKEN" "$API/issues/<n>"
```

Never print the token. The `curl ...` shorthand below means the authenticated call above.

## Conventions

- **Create an issue**: `fj issue create "<title>" --body-file <file>`. Write multi-line bodies to a temp file with a heredoc. `fj issue create` has no label flag, so apply labels right after creating.
- **Read an issue**: `fj issue view <n>` for the body, `fj issue view <n> comments` for the comments. For JSON with labels: `curl ... "$API/issues/<n>" | jq '{number, title, body, state, labels: [.labels[].name]}'`.
- **List issues**: `fj issue search --state open --labels <label>`. For JSON: `curl ... "$API/issues?state=open&type=issues&labels=<label>&limit=50" | jq '[.[] | {number, title, labels: [.labels[].name]}]'`. Keep `type=issues`, because without it the endpoint also returns PRs.
- **Make an issue a child of a parent**: Forgejo has no sub-issues. Put `Part of #<parent>` at the top of the child body and add the child to a task list in the parent body.
- **Comment on an issue**: `fj issue comment <n> "..."`, or `--body-file <file>` for multi-line comments.
- **Apply / remove labels**: `fj issue edit <n> labels --add "..."` / `--rm "..."`. Repeat the flag for several labels.
- **Close**: `fj issue close <n> --with-msg "..."`.

Renovate owns the "Dependency Dashboard" issue. Leave it out of triage.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `fj pr` equivalents:

- **Read a PR**: `fj pr view <n>`, `fj pr view <n> comments`, and `fj pr view <n> diff`.
- **List external PRs for triage**: `curl ... "$API/pulls?state=open" | jq '[.[] | select(.user.login | IN("simonbrunou", "renovate") | not) | {number, title, author: .user.login, labels: [.labels[].name]}]'`.
- **Comment / label / close**: `fj pr comment`, `fj pr edit <n> labels --add`/`--rm`, `fj pr close`.

Forgejo shares one number space across issues and PRs, so a bare `#42` may be either. Resolve it with `curl ... "$API/issues/42" | jq .pull_request`: a non-null value means a PR.

## When a skill says "publish to the issue tracker"

Create a Forgejo issue on `origin`.

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

The `wayfinder:*` labels don't exist on the repo until the first map. Before applying one, check `fj repo labels simonbrunou/simonbrunou.bzh view` and create any missing label with `fj repo labels simonbrunou/simonbrunou.bzh create wayfinder:<name> <hex-color> -d "<description>"`.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. Create it with `fj issue create`, then add the label.
- **Child ticket**: an issue with `Part of #<map>` at the top of its body, listed in a task list in the map body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: Forgejo's native issue dependencies, enabled on this repo and visible in the UI. Mark `<child>` as blocked by `<blocker>` with `curl -s -X POST -H "Authorization: token $FJ_TOKEN" -H 'Content-Type: application/json' "$API/issues/<child>/dependencies" -d '{"owner":"simonbrunou","repo":"simonbrunou.bzh","index":<blocker>}'`. The `index` is the blocker's `#number`, not a database id. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children, then drop any with an assignee or an open blocker (`curl ... "$API/issues/<child>/dependencies" | jq '[.[] | select(.state == "open")] | length'` is above 0). First in map order wins.
- **Claim**: `fj issue assign <n> simonbrunou`, the session's first write.
- **Resolve**: `fj issue comment <n> "<answer>"`, then `fj issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
