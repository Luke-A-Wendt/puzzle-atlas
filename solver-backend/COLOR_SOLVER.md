# Color holds and shorter constructive solutions

The browser's manual solver protects **the color at each held address**, not the identity of its original sticker. A and B still request the exchange of the two selected physical stickers. Auto Solve keeps the complete identity-based solver as its baseline and, for explicitly supported color-only goals, shortens that legal witness in color space.

These layers preserve verified answers without pretending that every relaxed request can be classified cheaply. They add bounded work and compact offline tables; they do not enumerate all puzzle configurations or guarantee globally shortest full solutions.

## Conventions and dimensions

- `N = model.degree` is the number of node/pose addresses, with address set `Ω = {0,…,N−1}`.
- `K = model.stickerCount` is the number of physical stickers. Fixed fully occupied models have `K=N`; pose-expanded models can have `K<N`.
- `m` is the number of allowed unit-cost primitive moves.
- A primitive `P[j]` is an array of `N` integer destinations. `P[j][x]` is the destination of source address `x`.
- `THEN(p,q)[x] = q[p[x]]` executes `p` first, then `q`.
- A word `[j0,…,jL−1]` is chronological; its permutation is `P[jL−1] ∘ … ∘ P[j0]`.
- `c` is a length-`N` current color array, with `null` for empty poses. Labels compare exactly; brightness and screen coordinates do not enter the model.
- `F` is the held-address set; `a,b` are distinct occupied addresses outside `F`.

The manual endpoint goal is

\[
g(a)=b,\qquad g(b)=a,\qquad
c(g^{-1}(f))=c(f)\quad\text{for every }f\in F.
\]

Intermediate moves can disturb held locations. Every old solution satisfying `g(f)=f` also satisfies the new goal. The converse is false. Preserving colors at only a selected subset generally does **not** define a subgroup, so these constraints cannot replace the pointwise subgroup in Schreier–Sims.

## Manual interaction and one-shot API

The interface separates **ready execution** from **bounded construction**. A bright pair has an actual stored, verified primitive word of at most 5,000 moves. Selecting endpoint 2 retrieves that word, rechecks the current snapshot and all constraints, pauses briefly, and plays it without a fresh search. A mathematical feasibility proof without such a word is not ready. These pairs, unknown pairs, and proved-impossible pairs are all gray and disabled for swapping. Gray means no verified word is ready, not that impossibility has been proved. Manual Select remains available on every physical tile; Auto requires switching to Select before editing its holds. The bounded construction APIs below remain available programmatically; normal browser selection does not submit unresolved pairs.

```js
const result = solveSync(model, {
  protected: heldAddresses,
  swap: [a, b],
  mode: 'protected_swap',
  protection: 'endpoint',
  holdSemantics: 'color',
  colorByNode: currentColorArray,
  // occupiedNodes is additionally required by pose-expanded models.
}, {colorCache, maxMs: 3000});
```

The backward-compatible backend default is `holdSemantics:'sticker'`. Color semantics accepts `protected_swap` plus endpoint protection only. It rejects empty held/selected addresses, inconsistent occupancy, wrong color-array length and malformed labels. Labels must be strings, finite numbers or null. A validation failure is `invalid`, not a reachability theorem.

The retained one-shot `solveSync` dispatch in `src/color-solve.cjs` is:

```text
if F is empty:
    use the existing exact no-holds solver
inspect the short-operation catalog within min(100 ms,totalTime/8)
if a valid catalog witness exists:
    if its length > 2:
        try inverse-preimage BFS at shorter depths for at most 150 ms
        if needed and time remains, try strict bidirectional tuple BFS
            at shorter depths for at most 50 ms
        keep only verified improvements
    return the best delivered witness
run bounded inverse-preimage BFS
if it finds a witness or exhausts the complete tuple orbit: return its result
construct a strict identity-hold word with remaining time
    preferably reuse the complete cache with word-aware base reordering
if it finds a witness: independently verify and return it
otherwise return unknown
```

All one-shot phases remain within the supplied request budget. Without a catalog incumbent, color BFS uses at most `min(searchMs,450 ms,totalTime/3,remainingTime)`, at most 25,000 records, depth 12 by default, and at most 16 MiB estimated tuple storage. This API does not retain its frontier after returning. Programmatic callers can use the retained session below to continue a bounded search without repeating this one-shot dispatcher. Normal browser play offers only retained verified witnesses.

A strict impossibility is **not** a relaxed impossibility. A strict shortest witness is **not** necessarily relaxed-shortest. Its optimal flag is valid only if its length attains a lower bound independently proved for the relaxed problem. One-move catalog witnesses are trivially shortest for a distinct pair; longer catalog words have no general minimum-length claim.

## Retained programmatic search

This backend API remains available to programmatic callers. Normal browser selection offers verified-ready pairs only: gray nodes do not start this search, and the UI has no speculative Continue action. `ManualSwapSession` retains its frontier rather than restarting `solveSync`. Its `advance({budgetMs,onProgress})` takes a **cumulative** planning allowance. The retained protocol supports 3,000 → 10,000 → 30,000 → 60,000 ms, so continuation adds approximately 7,000, 20,000 and 30,000 ms after fully used slices. Downloading and waiting between calls do not consume planning time. Checkpoint granularity can cause small timing overruns.

```js
const {ManualSwapSession} = require('./src/manual-session.cjs');
const session = new ManualSwapSession(model, request, {
  colorCache, fullCache,
  maxSearchStates: 100000, maxSearchDepth: 30,
  maxStorageBytes: 48 * 1024 * 1024, maxOutputMoves: 5000
});
let result = session.advance({budgetMs: 3000, onProgress});
// To continue programmatically while result.search.canContinue and the request is unchanged:
result = session.advance({budgetMs: result.search.nextBudgetMs, onProgress});
```

The session owns one normalized request, treated as immutable. Its state includes:

- Primitive inverse arrays, the initial held/A/B tuple and full endpoint color or identity goal.
- The catalog scan cursor and an optional reusable cached strict constructor.
- A visited-key map and FIFO record array; each record stores its tuple, parent index, incoming primitive and depth.
- Both a queue head and a **next move index**, allowing a slice to stop halfway through a node expansion without repeating its tested transitions; and an optional already-tested pending row whose insertion is waiting for workspace.
- Active planning time and progress counters.

```text
CREATE-SESSION(model,request,limits):
    validate and copy request; treat its normalized endpoint problem as immutable
    inverses := inverse permutation of each primitive
    root := [held addresses...,a,b]
    records := [(root,parent=none,move=none,depth=0)]
    seen := {key(root)}; head := 0; nextMove := 0
    catalogCursor := 0; elapsed := 0; terminal := none

ADVANCE(cumulativeBudget):
    if terminal exists: return it without repeating work
    deadline := now + max(0,cumulativeBudget-elapsed)
    continue the saved short-operation catalog scan
    before the first cached attempt, advance this same BFS for
        at most min(150 ms, remaining time / 4)
    try the bounded cached strict constructor when scheduled
    if construction has permanently stopped and a pending BFS row now fits:
        enqueue that stored row and advance the move cursor without retesting
    while head < size(records):
        if slice expires: return resumable unknown, keeping every field
        row := records[head]
        if row.depth >= depth bound:
            mark truncated; head += 1; nextMove := 0; continue
        if nextMove == number of primitives:
            head += 1; nextMove := 0; continue
        j := nextMove
        next := componentwise inverses[j] applied to row.tuple
        if key(next) not in seen:
            if the complete original endpoint goal holds:
                reconstruct [j] followed by parent moves toward the root
                enforce output bound; independently verify; return solved
            enforce state guard
            if storage plus constructive reservation is unavailable:
                retain this computed row as pending; pause BFS
            append (next,parent=head,move=j,depth=row.depth+1)
            insert key(next) in seen
        nextMove += 1
    if depth was truncated: return terminal unknown(depth/output limit)
    return impossible only after the whole projected orbit is exhausted
    every return charges only active planning time to elapsed
```

The exact preimage state and leaf-to-root word order are justified below. The first goal discovered by this FIFO search has minimum primitive length under the requested color or identity semantics; a catalog or cached-constructor witness need not. All claimed words are independently verified before they can move the live puzzle.

The cached strict constructor is a bounded shortcut. Before its first attempt, the same retained BFS receives at most `min(150 ms,remainingTime/4)` to find an easy short word first; this probe uses the later search’s exact frontier. Completed preparation can be reused. Only an `unknown/time_limit` constructor result schedules a later attempt. Nominal constructive allowances at the four stages are 800, 2,500, 8,000 and 16,000 ms respectively, further bounded by time remaining in that slice. At the final 60-second stage, if BFS has already stopped at a hard limit, the constructor can use all remaining planning time. The independent BFS frontier stays intact. Thus **BFS transitions do not repeat across continuations**; a timed-out group-construction attempt is not itself a fully checkpointed computation. A strict negative still does not exclude a color-relaxed solution.

The retained worker protocol guards are 100,000 retained states, 48 MiB estimated working storage, projected BFS depth 30 and 5,000 output moves. The constructive route may return a word longer than the BFS depth cap, up to the output guard. The standalone session uses the output bound as its default depth bound when `maxSearchDepth` is omitted. The tuple estimate is `256+40q` bytes per record, with an initial inverse/metadata/temporary-row charge of `2mN+16N+32q+(256+40q)`. Retained prepared-cache storage is added. Before the first construction attempt and while a timed-out constructor remains eligible for another attempt, BFS reserves the larger of half the allowance and the retained preparation size. If that workspace reservation blocks insertion, retain the already-tested transition as a pending row. When construction stops permanently, release the extra reservation and insert that row if it fits; advance the move cursor without recomputing the transition. Retained preparation remains charged. The constructor receives at most the remaining allowance after BFS storage. These estimates differ from the actual browser heap. A BFS state/storage limit can permit continuation only when another constructive attempt can still do useful work. Once no unfinished route remains, or at the 60-second stage, a resource/time limit ends the attempt as `unknown`; it sets `canContinue=false` and returns a typed reason. It never claims the request is impossible. A complete projected-orbit exhaustion can prove `impossible`. Nothing executes for either kind of unsuccessful result.

`result.search` reports `budgetMs`, `elapsedMs`, `states`, `transitions`, `canContinue`, `nextBudgetMs`, `terminalReason` and `resumed`. State and transition counts expose actual search progress, not a fictitious percentage of the unknown full graph. A paused session remains in the same worker; it is not serialized into the result cache or persisted across page reloads. Only one manual selection owns that live work.

Holds, selected endpoints 1/2, full colors, occupied poses and the live sticker-address snapshot all belong to the session's validity contract. Changing the selection, puzzle state or mode, or canceling, destroys the old session. A stale reply cannot resume playback. Ready pairs continue to bypass the session: selecting endpoint 2 retrieves their stored word and independently verifies it against the live request before a short playback pause. A later background eligibility witness can make a previously resource-limited pair ready; this executes the new verified word instead of restarting the old search. Manual selection requests the actual exchange of the two specified endpoints, using its chosen holds. Full-solver placement/cycle checkpoints are not mislabeled as manual swaps. Auto-guided play exposes them through separate Move markers and a retained certificate; Auto Solve continues to use its existing verified incremental stages.

### Cached constructive fallback

`src/cached-swap.cjs` exports `solveCachedSwap` and reusable `CachedSwapSolver`. It obtains a strict witness from the existing complete stabilizer cache instead of rebuilding Schreier–Sims closure for the selected holds.

```text
restore the cached signed word DAG with its persisted IDs unchanged
restore any missing primitive leaves after the persisted DAG
extract compact strong generators using the certified base-orbit indices
retain a word reference with each generator
promote held addresses to the front by exact adjacent base swaps
    during each point orbit, retain representatives and their move words
    each new Schreier generator gets the corresponding
        representative word, generator word, inverse destination word
take the complete generators fixing the held prefix, plus their inverses
run Dijkstra on (a,b) -> (b,a), weighting edges by primitive-word length
reconstruct the word-DAG path, flatten within the output limit
independently replay the primitives and check the original request
```

With no holds, it uses primitive generators directly. The explicit strict `throughout` option filters primitives that move held nodes. A direct color request whose strict pair orbit is exhausted returns `unknown`, never relaxed impossibility.

Adjacent base changes preserve the certified subgroup indices as described in `ELIGIBILITY.md`; the additional word references make their proofs constructive. The weighted pair traversal minimizes the sum of stored generator lengths, not globally shortest primitive distance. Cancellation and different generators can change that relationship, so the result retains `optimal:false`.

Standalone default limits are 3 seconds, 5,000 output moves, a 48 MiB working-storage estimate, 100,000 pair states and 300,000 DAG nodes. The one-shot request dispatcher supplies at most `min(800 ms,remainingTime)` after the short projected search; the progressive session uses the scheduling above. A solved or strict-impossible cached answer ends that strict attempt; unknown/invalid leaves remaining time to the legacy chain builder. The color wrapper still converts strict impossibility to unknown. The worker loads the optional full cache in parallel with the color catalog for held requests. At most `N(N−1)` ordered pairs exist, and the weighted traversal costs `O(sN² log N)` priority-queue work for `s` directed actions, separately from base reordering and bounded word expansion. It allocates no complete-configuration table and requires no new precomputation.

## Exact inverse-preimage tuple search

Set `q=|F|+2`, and list destinations `t = [F…,a,b]`. Represent a candidate transformation by

\[
v(g)=\big(g^{-1}(t_0),\ldots,g^{-1}(t_{q-1})\big).
\]

The initial tuple is `t`. For held entries the target test is `c[v[i]] = c[F[i]]`; for the last two it is `v[q−2]=b` and `v[q−1]=a`.

Prepending move `j` to the chronological word changes `g` to `g∘P[j]`, so the next tuple is `P[j]⁻¹` applied to every component. Therefore equal tuples have equal future transitions and goal tests. Deduplication loses no information needed by the request.

```text
queue := [(tuple=t,parent=none,move=none,depth=0)]
seen := {key(t)}
for each queue record in insertion order:
    enforce depth, record, byte and time limits
    for each original primitive j:
        next := componentwise inverse(P[j]) applied to record.tuple
        skip if key(next) already seen
        if next satisfies the complete color/A/B goal:
            word := [j] followed by parent move indices toward the root
            independently replay word; return solved, optimal=true
        enqueue next with this parent, move j and depth+1
return impossible only if the queue was completely exhausted
```

Parent indices read **leaf to root** are already chronological because edges prepend moves. Reversing them is an error. FIFO breadth-first discovery gives a shortest witness in the supplied primitive alphabet. Only fully tested depth layers provide lower bounds after interruption.

There are at most `N!/(N−q)!` injective tuples, but this quantity is never allocated. With `V` retained tuples and `E` transitions, time is `O(Eq+mN)`, memory `O(Vq+mN)`. Inverse arrays occupy `mN` integers. The guard estimates each record as `256+40q` bytes. This is an accounting limit rather than a measured JavaScript heap bound.

## Short-operation precomputation

`tools/precompute-color.cjs` builds a catalog for every model. Its alphabet must contain a primitive inverse for every primitive.

```text
for each primitive a: consider [a]
for each ordered primitive pair a,b, consider:
    [a,b]
    [a,b,a^-1]
    [a,b,a^-1,b^-1]
    [a,b,a,b]
    [a,b,a,b,a,b]
keep only permutations having an actual two-cycle
deduplicate full permutations, retaining their shortest encountered word
if no such operation exists and m<=16:
    enumerate depth<=4 words, skipping adjacent inverse moves
    consider the words of lengths 3 and 4
prioritize single moves, then lower (2*word length + moved-node count)
retain <=10,000 operations and <=2 MiB JSON per model
sort retained operations by length and then support size
independently replay every word and compare every sparse-support entry
```

The usual word families cost `O(m²N)` array work before sorting. The depth-four fallback has a fixed small alphabet cap; it does not grow with scramble length. The catalog is not all words of length at most six.

Each schema-1 cache has `kind:'color-macros'`, `modelId`, `modelSignature`, `degree`, and `operations:[{word,support}]`. `support` is `[source,destination,…]` for every nonfixed source; omitted addresses are fixed. At runtime a color-valid support must deliver the starting held color to every held destination and contain the requested A/B two-cycle. Word replay independently confirms success. Corrupt or mismatched data never supplies an impossibility proof.

The initial compilation contained 34 models, 30,955 operations and 10,495,834 raw JSON bytes, with maximum word length six. After the subsequent catalog extensions, Axis Cube, and the 9×9×9 and 10×10×10 additions, the shipped 37-model catalogs contain 79,973 operations and 20,008,700 raw JSON bytes. The all-model compiler enforces a 20 MiB aggregate cap. The website lazy-loads only the current puzzle's catalog. The existing complete identity chains remain intact and continue to supply the constructive baseline and strict fallback.

From the repository root:

```sh
node solver-backend/tools/precompute-color.cjs
node solver-backend/tools/verify-color-precompute.cjs
node scripts/build-constrained-solver.cjs
```

## Eligibility and sound partial answers

For each candidate pair, the color analyzer combines these sources, prioritizing concrete primitive/catalog words before the two group analyses:

1. **Full-group negatives:** exact ordered-pair analysis with no holds, allowed up to 750 ms of the 3-second default request when holds exist. A pair impossible without holds is impossible with them. With no holds use every certified global answer and allow the remaining request time.
2. **Primitive/catalog positives and readiness:** a replay-verified legal operation with acceptable held colors and the required two-cycle proves feasibility. Retaining its entire word additionally establishes executable readiness. The primitive route remains available even without a catalog.
3. **Strict positives:** the existing exact held-stabilizer analyzer uses remaining time. Copy successful pairs only; discard strict negatives.

Unclassified pairs remain unknown in backend results, but gray and unselectable for website swapping until a verified witness is retained. A first endpoint is feasible if any candidate partner is feasible, impossible only if every partner is proved impossible, and unknown otherwise. It is **ready** only if at least one partner has a retained verified word. Equal or empty endpoints are excluded independently. Held endpoints follow the request's explicit exemption policy: the website temporarily exempts its selected endpoints while retaining their held markers. A bright A does not imply that every B is ready.

The mathematical pair representation keeps `knownPairs` and `feasiblePairs`, each `ceil(N²/8)` bytes, plus `firstStatus` with `N` bytes. Readiness adds `readyPairs` with `ceil(N²/8)` bytes and `readyFirstStatus` with `N` bytes. Together these arrays cost `3*ceil(N²/8)+2N` bytes, or 56,064 bytes for `N=384`, before words and other data.

`readyWitnesses` stores `{word,pairs}` records, where `word` is the full primitive-index array and `pairs=[a,b,…]` lists the endpoint pairs verified for that word. One operation can serve several pairs without duplicating its word. `eligibilityStatus(result,a,b)` reads mathematical feasibility; `eligibilityReady(result,a,b)` reads readiness; `eligibilityWitness(result,a,b)` retrieves the concrete word. Each has first-endpoint behavior where appropriate.

A result can prove a pair feasible while leaving it not ready. A complete result means every candidate pair has a mathematical classification, not that every pair has a ready sequence. The readiness word payload is capped at 2 MiB and shares the working-storage guard. Each record is charged the larger of its serialized JSON length and `128+8*(word.length+pairs.length)` bytes. If the word cannot be retained, do not set its ready bit; retain its mathematical proof if available. A ready bit must never survive removal of its word.

The analyzer's default LRU stores complete tables within 2 MiB, capped at 8 MiB; accounting includes readiness arrays and word payloads. This can mean a large result is returned but not cached. It does not make an uncached returned witness invalid.

Every color-dependent key includes the model, hold semantics, full `colorByNode`, held set, occupancy, candidate set and protection. Colors only at held addresses are insufficient: an unheld donor can change feasibility. Adding holds preserves a prior negative, and removing holds preserves a prior positive **only when the full color state and occupancy remain the same**. This is constraint inclusion, not subgroup closure.

After manual playback, the UI clears A/B, keeps the original held addresses and rebinds them to their new occupants. It refreshes availability for the new complete color state. Stale workers are rejected by request generations and current identity snapshots.

## Auto Solve in color space

`src/full-solve.cjs` first uses the complete cached stabilizer chain exactly as specified in `FULL_SOLVER.md`. `colorRelaxationSafe:true`, full occupancy and validated colors enable the second pass. Ghost, Mirror, Homer, Flat Diamond, Pyramorphix and MasterMorphix retain exact identity/pose goals; their colors alone do not express the entire geometric goal.

If this identity baseline is unreachable for a color-enabled request, the result is `unknown` with `color_goal_identity_baseline_unreachable`, not a color impossibility certificate. Another equal-color assignment may still be reachable. Identity-only mode retains its complete-chain impossibility proof. An already correct color state needs no moves.

The color optimizer does not invent an equal-color relabeling and then hope it is legal. It transforms an already legal solved witness:

1. Replay the exact baseline as full length-`N` color strings. Delete a retained segment whenever the complete color string repeats. Stop at the first solved color string. Equal color states have identical future color evolution under any common legal suffix, which proves deletion sound.
2. From each retained state, boundedly try original primitive moves. If a move reaches a later retained state, replace the longer interval with that legal one-move edge. The greedy pass picks the farthest later match it tests. It does not explore off-route configurations.
3. Retain surviving original stage-end flags and always retain the final state. For each boundary compute the set of goal-correct nodes, then its intersection over that boundary and every later boundary. This suffix intersection identifies colors safe to mark as secured.
4. Merge boundaries that add no newly secured colors. Compose each remaining stage and find the source of its newly solved target. Verify protected and newly solved colors at its endpoint.
5. Accept only if all goal colors are solved, every emitted stage is valid, and neither total moves nor stage count exceeds the baseline. Otherwise use the baseline.

The nominal extra optimizer budget is 250 ms, with at most 12,000 one-move bridge checks and a 16 MiB estimated record cap. Bridge checks use 70% of the time allowance so reconstruction/verification has time remaining. The existing overall solve deadline still applies. Mandatory-scan limits revert to the baseline.

For baseline length `L`, `Q` bridge checks and `B` boundaries, additional time is `O(N(L+Q+B))` plus witness replay. Color-record storage is `O(NL)` before its explicit cap. The method can greatly reduce animation and pause time, but it **adds** bounded CPU work; it does not promise less planning compute or improvement on every scramble.

Accepted plans carry `goalSemantics:'colors'` and `method:'color_quotient_witness_shortcuts'`. `src/auto-adapter.cjs` independently verifies the entire sequence, every actual source-to-target image, every protected/new color at each stage endpoint and the final goal. Identity tracking remains necessary to detect stale snapshots or incorrect engine moves. All intermediate turns can temporarily disturb held locations.

## Validation and measured scope

A useful exact fixture has generator `(0 1)(2 3)`, colors `[green,green,red,blue]`, hold `{0}` and pair `(2,3)`. The strict subgroup is identity, so a strict exchange is impossible. The single generator solves the color request exactly. Changing unheld address 1 to yellow invalidates that witness and must invalidate the color cache.

`data/color-solver/verification-report.json` contains 99 constructed requests using actual puzzle colors across the 34 models in that pre-Axis-Cube audit. Thirty requests were proved impossible under strict identity holds but have a verified one-to-six-move color witness. These are demonstrations of increased freedom, not a random workload or a claim of complete relaxed coverage.

`data/color-solver/auto-benchmark.json` records the pre-Axis-Cube benchmark of 34 puzzles × 3 deterministic 30-turn scrambles. All 102 plans pass independent verification, and one scramble per puzzle is additionally played through the real engine. In this run, moves total 32,021 → 29,866 and stages 3,461 → 2,989; 80 of 102 plans improve each count. Those are approximately 6.73% fewer moves and 13.64% fewer stages. Node planning time increases because the new pass does extra work; these figures are not a mobile-device speed guarantee or a shortest-distance claim.

Reproduction includes color-search small-group oracles, cache/support corruption tests, same-held-color/different-unheld-color cache tests, old strict regressions, worker/UI routing and full-engine replay. Resource exhaustion must remain `unknown`, never a fabricated impossibility proof.


## Incremental stages and progress presentation

Auto Solve plays the verified full solver's stages directly, including the eligible color-shortening pass described above. The displayed secured set starts with `initialProtectedNodes`. At each complete stage it includes the previous secured set, `protectedNodes`, and `newlySolvedNodes`. These goals are independently checked using the plan's color or exact-identity semantics. A 500 ms pause exposes each incremental placement; a stage longer than 300 moves uses multiple playback chunks without inventing intermediate endpoint guarantees.

The upper Auto Solve bar counts these progressively secured addresses. It does not count every color that happens to match the goal. The lower bar counts completed primitive moves within the current stage. Each step preserves its declared holds and adds solved addresses; unrelated coincidental goal matches can move again.

The interface has no separate percentage-solved footer. Canonical goal colors support Show goal and the guided plan’s declared goal checks; overlap is not a move-distance estimate. Let `C(x)` be the home addresses occupied by their correct goal color and `I(x)` the exact-home sticker addresses. Empty hypothetical poses do not count. Incidental goal overlap can decrease between smaller completed stages even while the secured count grows.

Manual Stop finishes the current primitive turn, verifies its played prefix, discards unplayed moves, and clears held/numbered selections because complete-operation constraints may not yet be restored. The first Auto Solve Stop instead completes the current stage; a second Stop now requests the current primitive boundary. Randomize and journal replay discard an uncommitted interpolated turn.

`src/guided-plan.cjs` remains an optional explicit backend operation. It concatenates stages until `C(before)⊆C(after)` and `J(after)>J(before)`, preserving all previous color matches instead of only the declared secured prefix. Its verifier checks those stronger invariants. This can merge dozens of incremental placements into one long word, so ordinary Auto Solve does not invoke it. A manual swap remains a separately verified two-endpoint request. The browser Auto control instead retains a complete verified incremental plan through `monotone-plan.cjs`; it does not call `groupGuidedPlan` or merge stages merely to preserve all incidental matches. It initially selects the plan’s secured set and then only increases that set as the user completes its guided Move steps. Selecting Auto does not execute a step.

Mirror mode changes presentation, not legal moves or immutable colors, and requires exact home poses for its goal. Its ring map remains available with silver nodes; Show goal is hidden.

The handbook and technical sections in `dist/solver-guide.js`, `dist/solver-tech-manual.js`, and `dist/solver-technical.js` document these current semantics.

## Automatic endpoint submission

The browser has no separate Go button. Only verified-ready endpoints are selectable. Selecting the second endpoint retrieves and independently verifies its stored word, then plays it after a short cancellable pause with the request snapshot still checked. If no sequence is returned, both endpoints clear immediately and Swap ① becomes active, with holds unchanged. The concise no-solution prompt invites another pair; technical failures can retain relevant recovery guidance. A failed search does not prove impossibility. First-endpoint shading aggregates the potential partner row: any ready partner makes it bright; otherwise it is gray. After endpoint 1 is selected, readiness is pair-specific. Gray is not a mathematical impossibility claim. The manual Select tool can still toggle gray nodes. A separate manual hint layer circles a ready pair when its unheld partner would newly correct at least one endpoint color. Other unheld locations can change, so this local criterion does not certify progress or finite completion. Auto’s white-ringed Move choices instead belong to one retained, certified next stage. Both kinds of solid white circle sit outside any dashed held circle.


## Auto-guided completion with increasing holds

The certified UI and worker contract is specified in [`ELIGIBILITY.md`](ELIGIBILITY.md#certified-auto-guided-choices). Auto prepares and verifies a complete route from the current configuration, stores its stages and cursor, and selects its initial secured holds. The first request may replace arbitrary user holds. Auto is a persistent toggle: it remains selected and exposes the next stage automatically after every completed user-selected pair. There is no need to click Auto again, and no replan or release of secured nodes between stages.

All offered white Move ①/Move ② choices select the same next stage. Its complete word restores every previous secured goal and adds at least one more; the independent stage verifier checks this before playback and the live engine checks the result afterward. Holds are updated at stage boundaries, not during intermediate turns. With `M` physical tiles, `M - |K|` strictly decreases at each complete step, so following the certified route finishes in at most `M - |K_initial|` stages. Turn counts are not globally minimized.

A guided operation may be a placement or cycle rather than an exchange. The Move label and choice kind make that explicit. For a currently empty shape-changing target, the markers identify two participating physical tiles while the certificate keeps the real target address. Ordinary Swap still requests a genuine two-way exchange and can be used independently after leaving guidance.

Auto disables direct hold editing and Clear. Select turns it off while preserving current holds and enables manual hold editing; clicking Auto again turns it off into manual pair selection. Making an unrelated move or interrupting a stage also discards the retained plan. A partial stop clears holds because the complete-stage restoration has not been established. Completed guided steps retain their nested secured set; a fully completed route keeps every goal location held. If planning or verification fails, Auto turns off and no speculative guided choice is offered. A preview canceled before its first move retains the verified route. A completed route leaves Auto on with all goal locations secured and no next choices. Ordinary Auto Solve is unchanged.
