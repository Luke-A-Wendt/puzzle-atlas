/* Source-aligned documentation only. No solver or puzzle state is changed. */
window.SOLVER_TECH_MANUAL = function ({section, subsection, code, math, table}) {
  const colorBody =
    `<p><strong>The website protects colors at held locations.</strong> The strict routines below remain the constructive fallback; they are sufficient but no longer necessary for a successful manual request. Let Ω={0,…,N−1}, c:Ω→colors∪{empty} be the current color array, H⊆Ω be the persistent held locations shown by the interface, a,b∈Ω be distinct occupied endpoints, and F=H∖{a,b} be the active held addresses sent to this request. Selecting a marked node as an endpoint suspends that hold for this exchange; it does not erase its held classification. A legal source-to-destination permutation g must exchange the selected stickers and restore every held location's color:</p>`+
    math('Exact endpoint color and selected-sticker constraints', '<mi>g</mi><mo>(</mo><mi>a</mi><mo>)</mo><mo>=</mo><mi>b</mi><mo>,</mo><mspace width=".5em"/><mi>g</mi><mo>(</mo><mi>b</mi><mo>)</mo><mo>=</mo><mi>a</mi><mo>,</mo><mspace width=".5em"/><mi>c</mi><mo>(</mo><msup><mi>g</mi><mrow><mo>−</mo><mn>1</mn></mrow></msup><mo>(</mo><mi>f</mi><mo>)</mo><mo>)</mo><mo>=</mo><mi>c</mi><mo>(</mo><mi>f</mi><mo>)</mo><mspace width=".5em"/><mo>∀</mo><mi>f</mi><mo>∈</mo><mi>F</mi>')+
    `<p>The backend option is <code>holdSemantics:'color'</code>, with <code>colorByNode</code> containing exactly N strings, finite numbers, or null entries. Equality is exact label equality, not a comparison of displayed RGB brightness. Null denotes an unoccupied geometric pose. The occupied-address set must agree with non-null entries, and holds/1/2 must be occupied. Color semantics is supported for <code>protected_swap</code> with <code>endpoint</code> protection. The default backend request without this option retains <code>holdSemantics:'sticker'</code> for compatibility; the website explicitly requests colors.</p>
    <p>The set of g preserving colors at only F generally fails closure under multiplication: one acceptable transformation can move a same-color donor out of reach of another. Therefore it is not substituted for a subgroup in Schreier–Sims. Instead, use bounded positive-witness methods and keep the strict pointwise subgroup as a safe sufficient route. No labeling of all interchangeable stickers and no global configuration graph is allocated.</p>`+
    subsection('tech-color-dispatch','One-shot backend dispatch and the limits of each proof',
      code('Color-aware manual request', `COLOR-SOLVE(model, F, a, b, c, budget):
  validate model, occupied colors, holds and endpoints
  if F is empty:
    return ordinary no-holds pair solver // identical request in both semantics
  candidate := shortest acceptable operation found in the short-macro catalog
  if candidate exists:
    if length(candidate)>2:
      try bounded color-preimage BFS up to length(candidate)-1, at most 150 ms
      replace candidate only if a shorter verified word is found
      if time remains, try strict bidirectional tuple BFS for at most 50 ms
      again replace only with a shorter independently verified word
    independently verify candidate; return SOLVED
  relaxed := COLOR-PREIMAGE-BFS(model,F,a,b,c,short budget)
  if relaxed is SOLVED or certified IMPOSSIBLE: return relaxed
  strict := original identity-hold solver with remaining request time
  if strict is SOLVED:
    independently verify colors and 1/2
    mark optimal only if its length meets the relaxed search lower bound
    return strict witness under color semantics
  return UNKNOWN // strict impossibility cannot exclude relaxed solutions`)+
      `<p>The catalog is a supply of legal words, not a complete reachability table. Scan candidate operations containing the required 1/2 two-cycle, test their incoming colors on F, and choose the shortest accepted stored word. A catalog witness proves feasibility; failure proves nothing. A one-move witness is shortest because distinct 1/2 require a nonidentity action. Longer catalog words have no general minimum-length certificate. One- and two-move catalog witnesses return promptly; a longer one supplies an incumbent for a small attempt to improve it before playback.</p>
      <p>This describes the retained one-shot <code>solveSync</code> API, not the resumable browser-session protocol below. Catalog inspection is capped at min(100 ms,total budget/8). An incumbent longer than two moves receives at most 150 ms of shorter-depth color search and, when time remains, at most 50 ms of strict bidirectional tuple search to compete with it. Without an incumbent, color search receives at most min(450 ms,configured short-search time,total budget/3,remaining time), with at most 25,000 stored tuples and 16 MiB estimated storage. Remaining time goes to the strict fallback. A successful strict fallback need not be shortest for the relaxed request, even if it was shortest under sticker holds. Only a lower bound proved for the relaxed request can certify that claim.</p>`)+
    subsection('tech-color-session','Retained backend search sessions: programmatic continuation',
      `<p><strong>Backend API, not the normal selection UI.</strong> The website offers verified-ready swaps only. The retained search protocol below remains available to programmatic callers; gray nodes do not start it and the normal interface has no speculative Continue action.</p><p><code>ManualSwapSession</code> keeps one immutable normalized request and a retained projected search in a browser worker. Its <code>advance({budgetMs,onProgress})</code> operation receives a <em>cumulative</em> planning allowance. The retained worker protocol supports cumulative allowances of 3,000, 10,000, 30,000 and 60,000 ms: after spending the full previous allowance, these permit approximately 7,000, 20,000 and 30,000 ms of additional planning. Asset download time and time spent waiting for another click do not consume that allowance. Runtime checks occur at checkpoints, so a slice can overrun slightly.</p>
      <p>A session retains normalized holds, the full current color/occupancy arrays and 1/2; primitive inverse arrays; the pair-index candidate list and its scan cursor; and the BFS seen map, record queue, parent indices, incoming moves, depths, queue head, next primitive index and an optional already-tested transition awaiting storage. Retaining only a layer number or restarting BFS with a larger deadline would repeat work. The move cursor also matters: a pause in the middle of expanding a node resumes its next untested outgoing edge.</p>`+
      code('Resumable exact projected search', `CREATE-SESSION(model, request, limits):
  validate and copy the normalized request; treat it as immutable
  precompute primitive inverses
  root := held addresses followed by [a,b]
  records := [(root,parent=NONE,move=NONE,depth=0)]
  seen := {key(root)}; head := 0; nextMove := 0
  catalogCandidates := pair-index list for {a,b}; catalogCursor := 0
  elapsed := 0; terminal := NONE

ADVANCE(cumulativeBudget):
  require the same immutable request; never replace it inside this session
  if terminal exists: return terminal without repeating work
  deadline := now + max(0,cumulativeBudget-elapsed)
  continue the retained indexed candidate scan; verify any returned witness
  when the catalog is exhausted, advance the retained same-color
    compensation scan for at most 250 ms and remaining time
  before the first cached attempt, advance this same BFS for
    at most min(150 ms, remaining time / 4)
  try the bounded cached strict construction when scheduled
  if construction has stopped permanently and a pending BFS row now fits:
    enqueue that stored row; advance the move cursor without retesting
    accept only a witness independently satisfying the original request
  while head < length(records):
    if time slice expires:
      retain every field; return UNKNOWN(canContinue if budget remains)
    row := records[head]
    if row.depth >= depthBound:
      mark truncated; head := head+1; nextMove := 0; continue
    if nextMove == numberOfPrimitives:
      head := head+1; nextMove := 0; continue
    j := nextMove
    next := componentwise inverse(P[j]) applied to row.tuple
    if key(next) not in seen:
      test the exact requested color/identity and 1/2 endpoint goal
      if goal holds:
        reconstruct [j] followed by parent moves toward the root
        enforce output bound; independently verify; return SOLVED
      enforce record bound
      if storage plus constructive reservation is unavailable:
        retain this computed row as pending; pause BFS
      append next with parent=head, move=j, depth=row.depth+1
      add key(next) to seen
    nextMove := nextMove+1 // edge now completed; never redo it on Continue
  if depth was truncated: return terminal UNKNOWN(depth/output limit)
  return IMPOSSIBLE only after the entire projected orbit is exhausted
  on every return, add only active planning time to elapsed`)+
      `<p>The cached strict constructor is a separate bounded shortcut. A successful prepared chain can be reused. Before the first cached attempt, the same retained BFS gets a probe of at most min(150 ms,remaining time/4), so an easy short solution need not wait for or expand a long constructive word. Only a constructor result with <code>time_limit</code> schedules another attempt. Its nominal allowances are 800, 2,500, 8,000 and 16,000 ms at the four stages, bounded by the actual time remaining. At the final 60-second stage, if BFS has already stopped at a hard limit, the constructor may use all remaining planning time rather than leaving it unused. The tuple frontier remains intact. Therefore BFS transitions are not replayed across continuations, but not every internal operation of a timed-out group construction is a resumable checkpoint. Strict impossibility never proves a color request impossible. Catalog or cached witnesses can be shorter to compute without being shortest in primitive turns.</p>
      <p>The retained protocol stops permitting continuation after the 60-second planning stage, or sooner when all remaining routes have stopped. A BFS memory/state limit can leave one useful continuation when a cached construction is still eligible for a longer attempt; a terminal limit with no such work remaining ends the session. The browser guards are 100,000 retained states, a 48 MiB combined working-storage estimate, depth 30 for projected BFS and 5,000 output moves. The BFS depth limit does not restrict a valid longer word from the constructive route; it limits which primitive paths BFS explores. The standalone session defaults its depth bound to the output bound when no depth is supplied. Each record is charged 256+40q bytes. Inverse arrays, initial metadata and one temporary/pending row are charged 2MN+16N+32q+(256+40q) bytes; retained cached preparation is additionally accounted. Before the first constructive attempt and while a timed-out attempt can be extended, BFS reserves at least half the storage allowance for construction, or the retained prepared-cache size if larger. If that reservation stops BFS, save the already-computed transition as a pending row. When construction stops permanently, release the extra reservation and enqueue that row if it fits; advance the move cursor without repeating the transition. Actual retained preparation remains charged. The constructor receives only the allowance left after current BFS storage. These are safeguards, not exact browser heap measurements. Loaded immutable move models and precomputed cache assets are separate from the bounded search-workspace estimate. Terminal resource limits return <code>unknown</code> with a reason and leave the puzzle unchanged. Only full projected-orbit exhaustion justifies <code>impossible</code>. No incomplete frontier is treated as an impossibility proof.</p>
      <p>Progress metadata includes the cumulative budget and planning time, retained-state and attempted-transition counts, whether work was resumed, whether another slice is allowed, the next budget and a terminal reason. Counts describe the bounded projected search, not the percentage of all puzzle configurations searched: the full search size is generally unknown. A newly created session can have a small initialization cost before its first progress update.</p>
      <p>A programmatic caller can retain a paused worker only for that exact request and live sticker-address snapshot. Altering the holds, endpoints 1 and 2, colors, occupied poses, puzzle state or mode invalidates the session and its continuation eligibility. Cancel also disposes of it. Selecting a ready pair bypasses construction: retrieve its stored word and independently replay it before playback. If background eligibility later supplies a verified word for a previously unresolved pair, the newly ready pair can use that witness without restarting its exhausted search. A failed check does not change the puzzle. Selecting a verified-ready endpoint 2 requests the exact exchange defined above automatically, shows the move count, and pauses briefly before playing a verified sequence. An unsuccessful request clears both endpoints, keeps holds, and returns to the first-endpoint tool. A full-solution placement is never advertised as a manual two-node exchange. Auto-guided play uses Move markers and a separate verified plan; ordinary Swap remains the exact endpoint exchange. Auto Solve uses its existing incremental stage playback below.</p>`)+
    subsection('tech-guided-checkpoints','Incremental Auto Solve stages and progress measurements',
      `<p>Auto Solve plays the independently verified stages returned by <code>solveFull</code>. Let S be the physical stickers, M=|S|, N the geometric addresses, h:S→{0,…,N−1} their injective home-address mapping, x:S→{0,…,N−1} their current-address mapping, and c(s) their immutable colors. Let C(x) contain home addresses occupied by their goal color and I(x) contain addresses occupied by their exact-home sticker. Empty hypothetical poses never count as physical stickers.</p>
      <p>Let J(x)=|C(x)| for a color-safe fully occupied model outside mirror mode, and J(x)=|I(x)| when exact identities or poses define the goal. This overlap does not measure the minimum remaining move distance.</p>`+
      math('Secured fraction equals secured physical addresses divided by physical sticker count', '<mi>q</mi><mo>=</mo><mfrac><mrow><mo>|</mo><mi>K</mi><mo>|</mo></mrow><mi>M</mi></mfrac>')+
      `<p>During Auto Solve, the upper progress bar counts a nested set K of secured addresses. Initially K is <code>initialProtectedNodes</code>, not every accidentally correct color. Stage i declares H<sub>i</sub>=<code>protectedNodes</code> and Δ<sub>i</sub>=<code>newlySolvedNodes</code>. Require K⊆H<sub>i</sub>; its complete word restores every H<sub>i</sub> and Δ<sub>i</sub> according to the plan’s color or identity semantics. Then K←K∪H<sub>i</sub>∪Δ<sub>i</sub>. Each nonempty incremental stage expands the secured prefix. The upper bar updates at verified stage pauses; the lower bar counts primitive moves completed in this stage. Because C(x) can also include unprotected incidental matches, the goal overlap J(x) need not increase between stages even though |K| does. The solver preserves its original plan and stage boundaries.</p>`+
      code('Verified incremental automatic playback', `AUTO-PLAY(snapshot, plan):
  independently verify the complete legal plan from snapshot
  K := set(plan.initialProtectedNodes)
  publish secured progress |K| / M to the upper bar
  for stage in plan.stages, in their existing order:
    require expected identity mapping = live identity mapping
    require K is a subset of stage.protectedNodes
    require every declared protected address currently meets the goal
    bind K to current occupants for held-node display
    animate the stage's primitive word in chunks of at most 300 moves
    verify each chunk against its predicted identity mapping
    require all protected and newly solved addresses meet the plan goal
    K := K union stage.protectedNodes union stage.newlySolvedNodes
    update the upper bar to the verified |K| / M
    pause 500 ms, then continue
  require final color or exact-pose goal
ON-FIRST-AUTO-STOP:
  if loading or planning: cancel before playback
  else: finish and verify the complete current stage, then exit
  while that stage runs: label the enabled button Stop now
ON-SECOND-AUTO-STOP-OR-MANUAL-STOP:
  finish only the current primitive move; discard the unplayed queue
  verify the completed prefix against its predicted permutation
  clear held and numbered selections
  discard remaining plan; partial endpoints need not restore holds`)+
      `<p><strong>Why small boundaries matter.</strong> Protecting the whole C(x), rather than the declared secured set K, forces a later stage to restore every coincidental correct color too. The optional <code>groupGuidedPlan</code> backend helper concatenates stages until C(before)⊆C(after) and J(after)&gt;J(before). That preserves a monotonic goal count but can merge almost the entire solve into one long operation. Normal Auto Solve deliberately does not call it. It preserves the existing verified placement boundaries, which are incremental constructions, not globally shortest swaps. Auto in the Hold controls now retains a verified incremental plan and lets the user choose one certified step at a time. It preserves the plan’s secured set rather than every incidental member of C(x). This provides finite completion without joining stages merely to preserve all color matches. It does not change ordinary Auto Solve or certify a shortest route.</p>
      <p><strong>Independent verification and cost.</strong> The verifier checks each primitive index, the source-to-target transport, inclusion of the earlier secured prefix, the protected and newly solved goals, equality of flattened and staged move lists, and the final goal. Identity-mode stages must fix the protected addresses pointwise; color-mode stages may substitute equal-colored stickers. For L primitive turns, M occupied stickers, N addresses, and B stages, replay costs O(L(N+M)) with additional node-set checks bounded conservatively by O(BN²); the plan uses O(L+BN+N+M) memory. No configuration graph is enumerated. The browser rejects stale live mappings and retains the 20,000-move full-plan limit. Stop verifies only the completed legal prefix, since a partially played stage does not have its endpoint guarantees.</p>`)+
    subsection('tech-color-isolated','Exact two-address audit and same-color compensation',
      `<p>Let T(a,b) denote the identity permutation with only a and b exchanged. The literal isolated-swap question is exactly T(a,b)∈G, where G is generated by the legal moves. This is stronger than holding all other visible colors: equal-colored stickers can exchange identities without changing those colors. In a pose-expanded model, the exact permutation also fixes every unused address.</p>
      <p>The offline audit forms orbits of unordered address pairs under the primitive generators. Conjugation carries T(a,b) to T(g(a),g(b)), so membership is constant throughout one pair orbit. Test one representative against the existing complete stabilizer chain, then assign that proven result to its entire orbit. No configuration graph is constructed. The pre-Axis-Cube audit covered 34 models and 251,486 unordered address pairs; every literal isolated transposition in that audited set was excluded by the complete-chain test. This historical count does not include the subsequently added Axis Cube. These counts include unused hypothetical poses in expanded models, not only physical stickers.</p>`+
      code('Exhaustive audit over pairs, not configurations', `AUDIT-EXACT-PAIRS(model, completeChain):
  seen := empty unordered-pair set
  for each 0 <= a < b < N:
    if {a,b} is seen: continue
    orbit := BFS from {a,b}, applying each primitive to both addresses
    mark all pairs in orbit seen
    membership := SIFT(T(a,b), completeChain)
    assign membership to every pair in orbit
  // Negative requires a validated COMPLETE chain for this exact move model.

SIFT(target, completeChain):
  residue := target; factors := []
  for level in chain order:
    image := residue[level.base]
    if image == level.base: continue
    if no transversal entry for image: return NOT_MEMBER
    t := that entry
    residue := execute residue, then inverse(t.permutation)
    append t.word to factors
  require residue == identity
  return MEMBER with factors reversed`)+
      `<p>A useful narrower color-preserving family is g=T(a,b)T(c,d), with four distinct occupied addresses and equal current colors at c and d. The selected stickers exchange exactly; the compensating pair exchanges identities but restores both colors; every other identity is fixed. Sifting this target either excludes that precise double swap or produces a factorization. Excluding every candidate in this family still does not exclude longer equal-color cycles or more complicated legal color-preserving permutations.</p>`+
      code('Resumable same-color compensation fallback', `COMPENSATED-SWAP(model, a, b, colors, completeChain, budget):
  retain cursor over disjoint occupied pairs {c,d}
  first test T(a,b); subsequently test only colors[c] == colors[d]
  while time remains and candidates remain:
    target := T(a,b) T(c,d)
    result := SIFT(target, completeChain)
    if NOT_MEMBER: advance cursor; continue
    try expanding reversed factors within time and output limits
    replay every primitive independently
    verify selected identities, held colors and occupancy
    if verified: return SOLVED, optimal=false
    if expansion exceeded a limit: remember the limitation; continue
  retain cursor if paused
  return UNKNOWN if this family is exhausted or any resource limit applies`)+
      `<p>The retained backend session runs this optional scan after catalog inspection in slices of at most 250 ms. Its cursor, count and chain preparation survive Continue. Memory for lazy inverse transversals and word expansion is reserved before enabling it; tight budgets skip this optional route. It shares the existing 5,000-move output limit. A time- or output-limited expansion is not an impossibility proof. Cached strict construction and the retained projected search remain available independently.</p>
      <p>The offline catalog additionally stores verified exact double-swap words taken from complete-chain transversals and short conjugations. The initial added family contained 2,760 words across 16 puzzles, using 227,360 additional bytes before audit metadata; later sparse conjugacy may add or shorten equivalent-support witnesses. Caps are 512 new operations and 512 KiB per puzzle, with at most 1,500 primitive turns per added word. Every word is replayed before export. Runtime catalog lookup checks the actual current colors and request again: the same word need not preserve colors after a different scramble. The cached family is deliberately incomplete, and no shortest-word claim is made.</p>
      <p>For degree N and M primitive generators, the pair graph has N(N−1)/2 vertices and at most M outgoing transitions per vertex. Orbit construction costs O(MN²) time and O(N²) auxiliary storage. With R pair orbits, straightforward full-base sifting adds O(RN²) time, excluding the already-built chain and output expansion. An on-demand scan can examine O(N²) compensating pairs, each with O(N²) worst-case array sifting; it is therefore bounded in the browser rather than promised constant-time. Implementations: <code>permutation-membership.cjs</code>, <code>color-compensation.cjs</code>, and <code>tools/precompute-transpositions.cjs</code>.</p>`)+
    subsection('tech-color-tuple','Backward preimages: a sufficient projected state',
      `<p>Track q=|F|+2 preimages rather than the identities initially held. For t=(f₀,…,fₜ₋₁,a,b), define v(g)=(g⁻¹(t₀),…,g⁻¹(tq−1)). Start at v(I)=t. The goal test is c[vᵢ]=c[fᵢ] for each hold, vq−2=b and vq−1=a. The last two equations are equivalent to g(b)=a and g(a)=b. This tuple retains exactly the information needed for these endpoint constraints.</p>
      <p>Let Pⱼ be a source-to-destination primitive. Prepending that move to the chronological word changes g to g∘Pⱼ, hence (g∘Pⱼ)⁻¹=Pⱼ⁻¹∘g⁻¹. The transition is therefore componentwise v′ᵢ=Pⱼ⁻¹[vᵢ]. The tuple transition depends only on v, so deduplicating equal tuples is exact. Reading parent move indices from the found leaf toward the root already gives the chronological forward word; do not reverse that list.</p>`+
      code('Single-source breadth-first color transporter', `COLOR-PREIMAGE-BFS(P,F,a,b,c,limits):
  start := F followed by [a,b]
  inverse[j] := INVERSE(P[j])
  records := [(tuple=start,parent=NONE,move=NONE,depth=0)]
  seen := {key(start)}; queueHead := 0
  while queueHead < length(records):
    row := records[queueHead]
    stop UNKNOWN at depth, time, state or storage limit
    for j from 0 to M-1:
      next := [inverse[j][x] for x in row.tuple]
      if key(next) in seen: continue
      if next[last-1]=b and next[last]=a
         and every c[next[i]]=c[F[i]]:
        word := [j]
        walk row's parents to the root, appending each stored move
        independently verify word; return SOLVED(word,optimal=true)
      append (next,parent=queueHead,move=j,depth=row.depth+1)
      add key(next) to seen
    queueHead := queueHead+1
  return IMPOSSIBLE(complete color-preimage tuple orbit exhausted)`)+
      `<p>FIFO BFS visits tuple depths in increasing order and tests every newly reached state. Its first witness has minimum primitive length for this color-hold request under the supplied unit-cost move alphabet. If interrupted, only completed depth layers justify a lower bound. An exhausted complete tuple orbit can prove impossibility; a depth cap, catalog miss or strict-subgroup exclusion cannot.</p>
      <p>There are at most N!/(N−q)! injective tuples, which can still be enormous. The implementation never allocates that bound: it stores at most its configured state and byte budgets. For V retained tuples and E attempted transitions, time is O(Eq+MN), storage O(Vq+MN); E≤MV for completed expansions. Inverses occupy MN integer entries. The per-record accounting estimate is 256+40q bytes, covering tuples, strings and map/queue overhead. This is a bounded search improvement, not a polynomial-time solution to shortest factorization.</p>`);
  const searchBody =
    `<p><strong>Strict fallback specification.</strong> The following bidirectional and group algorithms describe <code>holdSemantics:'sticker'</code>. They ask for a legal permutation <var>g</var> with <var>g(a)=b</var>, <var>g(b)=a</var>, and <var>g(f)=f</var> for every <var>f∈F</var>. Other unheld stickers may move. Every successful strict witness satisfies color holds too; strict failure and optimality claims must be interpreted only within this more restrictive subproblem.</p>
    <p>The strict route first tries bounded bidirectional search on the projected tuple. The browser can then construct a word from the existing complete cache by reordering its base while retaining move expressions. The original on-demand chain builder remains the uncached backend route. These routes share the same exact endpoint verification but have different construction costs.</p>` +
    subsection('tech-search-contract', 'Request normalization and protection semantics',
      `<p>Let <var>N</var> be the permutation degree, <var>M</var> the number of legal primitive moves, <var>t=|F|</var>, and <var>q=t+2</var>. A move is a length-<var>N</var> bijective array of integers in 0…N−1. All primitive costs must equal 1. Current limits accept 2≤N≤4096 and 1≤M≤512. Move names and address IDs must be unique. Reject state-dependent legality, malformed permutations, duplicate endpoints, or an endpoint in the held set. Deduplicate and sort holds.</p>
      <p>For a model with an expanded pose domain, require the current occupied-address list: its length equals the physical sticker count, its addresses are distinct, and every selected address is occupied. This prevents selecting an empty hypothetical pose. Color equality is not used: protection refers to physical sticker identities at their selected addresses.</p>` +
      table(['Option', 'Exact meaning'], [
        ['<code>protected_swap</code> / <code>endpoint</code>', 'The strict backend subproblem when holdSemantics is sticker. Fix the explicitly held addresses at the end; exchange a and b; permit other changes. The website uses the color wrapper above.'],
        ['<code>exact_swap</code>', 'Backend option: hold every other occupied address. In a fully occupied model this requests exactly the transposition (a b), which may be illegal. In an expanded model unused pose addresses remain unconstrained.'],
        ['<code>throughout</code>', 'Backend option: keep only primitive moves p with p(f)=f for every f∈F. Run the same algorithms on that reduced generator list. This disallows temporary movement of holds and can reject an exchange possible under endpoint semantics.']
      ]) +
      `<p>The move-index map from the filtered list back to the original model must be retained. An empty throughout-preserving move list proves a distinct-endpoint exchange impossible. Normalization failures produce <code>invalid</code>, not a mathematical impossibility certificate.</p>`);

  const searchDetails = subsection('tech-search-projection', 'The projected state and why it is sufficient',
    `<p>The initial ordered tuple is <code>s=(f₀,…,fₜ₋₁,a,b)</code>; its target is <code>z=(f₀,…,fₜ₋₁,b,a)</code>. Each entry tracks the current address of the sticker that began at that selected address. A primitive move acts on every tuple entry: <code>p·v=(p[v₀],…,p[vq−1])</code>. Two full configurations with the same tuple are indistinguishable for this request, so store the tuple once. This quotient loses no information needed for the endpoint constraints.</p>
    <p>Every projected edge still names a genuine whole-puzzle move. Reaching z therefore supplies a legal full-puzzle witness, although untracked stickers can differ. The tuple graph has at most N!/(N−q)! vertices because its entries are distinct; physical move restrictions usually make its orbit smaller. This bound can still be enormous. The implementation explores only a bounded portion, never allocates this bound, and never constructs an M<sup>L</sup> array of move words.</p>
    <p>A stored record contains a length-q integer tuple, its comma-separated key, parent key, incoming original move index, and depth. Forward edges apply p; backward edges apply p<sup>−1</sup>. One inverse length-N array is precomputed per primitive move. Identity moves, duplicate tuple visits, and repeated ways to reach a tuple have no effect; no heuristic pruning of unseen tuples is used.</p>`) +
    subsection('tech-search-bfs', 'Bidirectional BFS, reconstruction, and its optimality certificate',
      code('Projected bidirectional search', `PROJECTED-BFS(P[0..M-1], F, a, b, limits):
  s := concatenate(F, [a,b]); z := concatenate(F, [b,a])
  PINV[j] := INVERSE(P[j]) for j in 0..M-1
  Forward := {seen: {key(s): (s,null,-1,0)}, frontier: [key(s)], radius: 0}
  Backward := {seen: {key(z): (z,null,-1,0)}, frontier: [key(z)], radius: 0}
  bytesPerState := 256 + 40 * length(s)
  stateLimit := min(maxStates, floor(maxBytes / bytesPerState))
  if stateLimit < 2: return UNKNOWN(lowerBound=1, storage/state limit)
  loop:
    if Forward.radius + Backward.radius >= maxDepth:
      return UNKNOWN(lowerBound=Forward.radius+Backward.radius+1)
    choose side with smaller frontier; break ties toward Forward
    other := opposite side; generators := P if Forward else PINV
    next := []; meeting := NONE; bestLength := infinity
    for parentKey in side.frontier:
      row := side.seen[parentKey]
      for j in 0..M-1:
        check time periodically; on exhaustion return UNKNOWN
        v := [generators[j][x] for x in row.tuple]
        k := key(v)
        if k in side.seen: continue
        if total stored records >= stateLimit: return UNKNOWN
        depth := side.radius + 1
        side.seen[k] := (v,parentKey,j,depth); append k to next
        if k in other.seen:
          length := depth + other.seen[k].depth
          if length < bestLength: meeting := k; bestLength := length
    side.frontier := next; side.radius := side.radius+1
    if meeting exists:
      prefix := incoming indices walking Forward parents to its root
      reverse(prefix)
      suffix := incoming indices walking Backward parents to its root
      return SOLVED(prefix followed by suffix, optimal=true,
                    lowerBound=bestLength)
    if next is empty: return IMPOSSIBLE(complete tuple orbit exhausted)`)+
      `<p>Finish the <em>whole current layer</em> before returning the shortest meeting found in it. Merely returning the first collision from an arbitrarily expanded frontier would not establish this guarantee. A backward record reached its child by p<sup>−1</sup>; walking that child back to its parent therefore executes the original move p. Consequently the backward suffix uses the stored original move indices without replacing them by inverse indices or reversing the parent walk.</p>
      <p>Each completed radius describes a complete breadth-first ball. Before a collision, the two balls are disjoint. If their radii are r<sub>F</sub> and r<sub>B</sub>, any connecting word has length at least r<sub>F</sub>+r<sub>B</sub>+1. Completing the next layer and choosing its best meeting attains the first possible connecting distance. The returned word is therefore globally shortest <em>for this protected exchange and the supplied unit-cost primitive set</em>, not necessarily for solving the entire puzzle.</p>
      <p>Time is checked every 256 attempted transitions. If time, depth, or storage expires mid-layer, discard the incomplete layer as an optimality proof and return <code>unknown</code>; the lower bound uses only completed radii. Exhausting a frontier without a meeting proves the target is outside the complete tuple orbit and gives <code>impossible</code>. For finite permutations, inverse reachability and positive-word reachability coincide, even when an inverse is not listed as a primitive action.</p>`) +
    subsection('tech-search-dispatch', 'Dispatch, browser budgets, and cost',
      code('Manual request dispatcher', `MANUAL-SOLVE(model, request, options):
  validate model and normalize request
  if protection is throughout:
    filter primitive moves to those fixing every held address
  r := PROJECTED-BFS(filtered model, holds, a, b, short-search limits)
  if r is SOLVED: remap its move indices to original model indices
  if r is SOLVED or IMPOSSIBLE, or group fallback is disabled: finish(r)
  remainingTime := total budget - elapsed time
  if remainingTime <= 0: finish(UNKNOWN)
  if endpoint protection and (full cache exists or holds are empty):
    c := CACHED-SWAP(model,fullCache,holds,a,b,min(800 ms,remainingTime))
    if c is SOLVED or IMPOSSIBLE:
      retain r.lowerBound; certify optimal only if a witness attains it
      finish(c)
    recompute remainingTime; finish UNKNOWN if no time remains
  g := GROUP-EXCHANGE(filtered model, holds, a, b, remaining limits)
  if g is SOLVED:
    restore original move indices; retain r.lowerBound
    if g is not optimal, shortening is enabled, protection != throughout,
       and more than 10 ms remain:
      shorten without changing the permutation, for min(150 ms,time left)
    if length(g.word) == r.lowerBound: g.optimal := true
  finish(g): enforce output length; independently replay and verify
             the endpoint constraints before publishing a witness`)+
      table(['One-shot solveSync bound', 'Default'], [
        ['Projected BFS time / stored records / depth', '500 ms / 25,000 / 12'],
        ['BFS estimated storage ceiling', '32 MiB'],
        ['Group storage / generators / word-DAG nodes', '64 MiB / 2,000 / 100,000'],
        ['Orbit records / Schreier tests', '100,000 / 3,000,000']
      ])+
      `<p>The one-shot API remains useful for tools and tests. It does not retain its frontier after returning. The retained worker continuation route is specified above and has its own lifetime and limits; advancing that API does not restart this one-shot call. Normal browser selection uses verified-ready pairs only. The standalone threaded API also enforces a worker heap limit and a total time +500 ms timeout.</p>
      <p>For V stored tuples and E attempted edges, tuple transformations and key construction cost O(Eq), with E≤MV for completed expansions; storage is O(Vq+MN). The implementation estimates 256+40q bytes per record to include keys, maps, frontier references, and allocation overhead. This is an accounting guard, not an exact JavaScript heap measurement. Limits yield <code>unknown</code>, never a fabricated proof of illegality.</p>`);

  const holdsBody =
    `<p>The pointwise stabilizer of the held addresses is H={g∈G : g(f)=f for every f∈F}. All its elements preserve the holds at the endpoint. The problem is now whether the H-orbit of the ordered pair (a,b) contains (b,a). An ordinary point orbit is insufficient: a generator may send a to b without simultaneously sending b to a.</p>
    <p>Use <code>THEN(p,q)[x]=q[p[x]]</code> for chronological composition. If T<sub>x</sub> sends a base point to x and y=s(x), the Schreier element is <code>THEN(THEN(Tx,s), INVERSE(Ty))</code>. It fixes that base point. Its chronological move word is the word for T<sub>x</sub>, followed by the word for s, followed by the reversed inverse word for T<sub>y</sub>.</p>` +
    math('A Schreier generator fixes the orbit base point', '<mi>h</mi><mo>=</mo><msup><msub><mi>T</mi><mi>y</mi></msub><mrow><mo>−</mo><mn>1</mn></mrow></msup><mo>∘</mo><mi>s</mi><mo>∘</mo><msub><mi>T</mi><mi>x</mi></msub><mo>,</mo><mspace width="0.5em"/><mi>y</mi><mo>=</mo><mi>s</mi><mo>(</mo><mi>x</mi><mo>)</mo>') +
    subsection('tech-holds-witness', 'Constructing the manual witness subgroup',
      code('Group exchange fallback', `GROUP-EXCHANGE(P, F, a, b, limits):
  create bounded word DAG with one leaf per primitive move
  if length(F) == 0:
    S := all nonidentity primitive generators with their leaf words
  else if length(F) == 1:
    f := F[0]
    compute complete point orbit of f under primitive generators
    store representative T[x], word W[x] for each reached x
    S := empty; seenPermutations := empty
    for x in that orbit:
      for primitive generator p with word w:
        y := p[x]
        h := THEN(THEN(T[x],p), INVERSE(T[y]))
        if h is nonidentity and not already in S:
          append (h, LIST([W[x],w,-W[y]])) to S
          enforce generator, DAG, time, orbit and storage limits
  else:
    B := F followed by [a,b], then every unused address in numeric order
    chain := BUILD-CHAIN(P,B,unweighted), including complete Schreier closure
    S := chain strong generators whose first moved base index >= length(F)
  route := PAIR-TRANSPORT(S,a,b)
  if route does not exist after complete orbit exhaustion:
    return IMPOSSIBLE(pair outside stabilizer orbit)
  word := concatenate DAG words of route's generators
  moves := bounded FLATTEN(word), cancelling adjacent inverses
  replay moves as a full permutation and verify holds and both endpoints
  return SOLVED(moves, optimal=(length(F)==0))`)+
      `<p>The single-hold route uses Schreier’s lemma directly; it does not need a full chain. With two or more holds, the complete base begins with all holds, so the generators at level t or deeper generate exactly H. The full chain and word-DAG algorithms are given in the stabilizer chapter. Their limits remain active here; an incomplete subgroup cannot justify an impossibility verdict. A limit thrown during subgroup construction, pair search, or word expansion becomes <code>unknown</code>.</p>`) +
    subsection('tech-holds-pair', 'Ordered-pair BFS and witness reconstruction',
      code('Transport an ordered pair', `PAIR-TRANSPORT(S[0..s-1], a, b):
  encode(x,y) := x*N + y
  start := encode(a,b); goal := encode(b,a)
  records[start] := (parent=NONE,generator=NONE); queue := [start]
  for state in queue, in insertion order:
    x := floor(state/N); y := state mod N
    for i in 0..s-1:
      next := encode(S[i].perm[x], S[i].perm[y])
      if next in records: continue
      enforce pair-orbit, time and storage limits
      records[next] := (state,i); append next to queue
      if next == goal:
        route := generator indices on parent path goal -> start
        return reverse(route)
  return NO-ROUTE`)+
      `<p>There are at most N(N−1) distinct pairs with unequal endpoints. Each transition performs two array lookups, so the complete search costs O(sN²) time and O(N²) parent/queue storage, aside from O(sN) stored generator permutations. The runtime allows at most 100,000 orbit records and estimates 120 bytes per pair record. Early success may be much cheaper.</p>
      <p>This BFS minimizes the number of <em>subgroup generators</em>, each of which can expand to many primitive moves. It therefore does not prove a shortest primitive solution when holds are present. With no holds, the generators are the original primitive moves and that particular BFS is optimal. A later equality between the verified word length and the short-search lower bound is another valid optimality certificate. Otherwise the UI explicitly says shortest length is not proved.</p>`)+
    subsection('tech-holds-cache', 'Getting an arbitrary stabilizer from a certified cached chain',
      `<p>Mathematical availability needs reachability; executable readiness also needs a primitive word. Both can reuse the precomputed chain and reorder its base so the requested held addresses come first, avoiding a fresh Schreier–Sims closure. The constructive route additionally retains the legal word DAG through every base change. The cached implementation stores a full base of N distinct addresses, even though a shorter mathematical base can suffice. Its certified level sizes d<sub>k</sub>=|H<sub>k</sub>·b<sub>k</sub>| satisfy |H<sub>k</sub>|=d<sub>k</sub>|H<sub>k+1</sub>|.</p>
      <p>Before use, require schema version 1, <code>status=ready</code>, <code>complete=true</code>, matching degree and model signature, a base permutation of all N addresses, and N matching levels. Each retained representative must be a bijection, fix the preceding base prefix, and map its level’s base address to the claimed image. The browser additionally checks the downloaded asset hash when its cryptographic API is available.</p>`+
      code('Recover a small strong-generator set from cached representatives', `PREPARE-CACHED-CHAIN(cache):
  B := cache.base; d[k] := 1 + number of nonidentity entries at level k
  S := []
  for k from N-1 down to 0:
    reached := {B[k]}
    for representative T in cache.level[k], in stored order:
      if T[B[k]] is already reached: continue
      validate T; append (T,level=k) to S
      reached := complete orbit of B[k] under S
      if size(reached) >= d[k]: break
    require size(reached) == d[k]
  return (B,d,S)`)+
      `<p>At level k, S already generates H<sub>k+1</sub>. A subgroup K≤H<sub>k</sub> containing H<sub>k+1</sub> equals H<sub>k</sub> once its orbit of b<sub>k</sub> reaches the certified size d<sub>k</sub>: orbit–stabilizer then gives equal group orders. This is why retaining every cached representative is unnecessary. Cache certification is established by precomputation; shape and image checks alone are not a replacement for that certificate.</p>`)+
    subsection('tech-holds-base-swap', 'Adjacent base swaps: exact index calculation and construction',
      `<p>Suppose two adjacent base entries are a=b<sub>k</sub> and b=b<sub>k+1</sub>. Let K fix the prefix before them, and L=K<sub>a,b</sub>. The old two indices give [K:L]=d<sub>k</sub>d<sub>k+1</sub>. After swapping the entries, compute e=|K·b|. The required orbit size for a under K<sub>b</sub> is therefore d′=d<sub>k</sub>d<sub>k+1</sub>/e. This must be a positive integer.</p>`+
      math('Orbit index after swapping two adjacent base entries', '<mi>d</mi><mo>′</mo><mo>=</mo><mfrac><mrow><msub><mi>d</mi><mi>k</mi></msub><msub><mi>d</mi><mrow><mi>k</mi><mo>+</mo><mn>1</mn></mrow></msub></mrow><mi>e</mi></mfrac><mo>=</mo><mo>|</mo><msub><mi>K</mi><mi>b</mi></msub><mo>·</mo><mi>a</mi><mo>|</mo>')+
      code('Exact adjacent base change', `ADJACENT-SWAP(chain,k):
  a := B[k]; b := B[k+1]
  U := strong generators with level >= k       // generate K
  (orbitB,T) := complete orbit of b under U, with representatives
  e := size(orbitB); target := d[k]*d[k+1]/e
  require target is a positive integer
  FixB := all generators in U that already fix b
  reached := complete orbit of a under FixB
  require size(reached) <= target
  for x in orbitB, until size(reached)==target:
    for s in U:
      y := s[x]
      image := INVERSE(T[y])[s[T[x][a]]]
      if image is already reached: continue
      h := THEN(THEN(T[x],s), INVERSE(T[y]))
      append (h,level=k+1) to FixB and to chain generators
      reached := complete orbit of a under FixB
      require size(reached) <= target
      stop generating when size(reached)==target
  require size(reached)==target
  B[k] := b; B[k+1] := a; d[k] := e; d[k+1] := target
  for each generator previously at level k or k+1:
    assign level k+1 if it fixes b, else level k`)+
      `<p>FixB initially contains the deeper subgroup L. Every added Schreier element fixes b. Reaching the certified target orbit size therefore proves FixB generates K<sub>b</sub>; stop without forming every possible Schreier generator. Levels deeper than k+1 still fix the same set of prefix addresses, and higher levels are unchanged.</p>
      <p>To place the holds first, order them as they appeared in the old base. For each held entry, bubble it left into its next prefix position using adjacent swaps. This preserves the relative order within held and unheld entries and uses at most t(N−t) swaps. Return generators with level≥t. If the generator count grows above max(2s₀,400), where s₀ is the prepared count, compact bottom-up using the same certified-orbit-size test as preparation.</p>
      <p>This route stores full length-N representatives while reordering; it is not merely sorting labels. A representative orbit of size o requires O(oN) permutation entries. Generator composition costs O(N), and repeated orbit recomputation costs O(o·s) transitions each time. There is no promise that every arbitrary held subset fits the current budget, but its cost depends on points, generators, and base changes—not on explicitly storing every puzzle configuration.</p>`)+
    subsection('tech-holds-cached-word','Construct a playable word from the existing chain',
      `<p><code>solveCachedSwap</code> and reusable <code>CachedSwapSolver</code> add move expressions to that same base-change procedure. Restore the cache's signed word DAG without renumbering its persisted nodes; restore omitted primitive leaves afterward. Validate references, primitive indices and DAG size before use. Extract the same compact strong generators as above, now retaining each representative's word reference.</p>
      <p>During a representative orbit, store W[y]=W[x] followed by the generator word when y is first reached from x. Every new Schreier element carries W[x], the generator word, and −W[y]. Its full permutation and expression must agree. Signed references encode inverses without immediately expanding them. After promoting holds, the retained level≥|F| generators and their inverses give a complete strict subgroup with legal words.</p>`+
      code('Cached constructive strict transporter', `CACHED-SWAP(model, cache, F, a, b, limits):
  restore and validate cached word DAG; add any missing primitive leaves
  if F is empty: use original primitive generators and words
  else:
    prepare complete cached chain using certified orbit indices
    reorder base to place F first, retaining a word with every generator
    S := generators fixing the held prefix
  actions := S together with their inverses
  run Dijkstra on ordered pairs, from (a,b) to (b,a):
    edge (x,y) -> (s[x],s[y]) has cost expandedLength(s.word)
    keep smallest distance and parent/action per pair
    skip stale priority-queue entries
  if complete pair orbit excludes target:
    return IMPOSSIBLE for sticker holds, UNKNOWN for color holds
  concatenate action-word references along the selected parent route
  flatten once under primitive-output and expansion limits
  independently replay every primitive; verify holds and 1/2
  return a concrete verified word, optimal=false`)+
      `<p>Dijkstra minimizes the sum of stored generator-word lengths on this chosen subgroup action graph. Final cancellation may shorten the expanded word, and different generators or color substitutions may do better. It is not a proof of minimum primitive distance. The ordered-pair graph has at most N(N−1) states; for s directed generator actions, its full traversal uses O(sN² log N) priority-queue work, before base reordering and word expansion. It does not enumerate full puzzle configurations.</p>
      <p>Standalone defaults are 3,000 ms, 5,000 output moves, a 48 MiB working-storage estimate, 100,000 pair states, and 300,000 DAG nodes. The one-shot request dispatcher gives this attempt at most min(800 ms,remaining time), after the strict projected search and before the legacy chain builder. The progressive browser session instead uses the scheduling specified above. A cached solved/impossible answer ends that strict attempt; an unknown or invalid cached attempt leaves any remaining time to the legacy fallback. The color wrapper still downgrades strict impossibility to unknown. No-holds transport uses the same ordered-pair method on primitive actions without loading a chain. No new precomputed table is required.</p>`);

  const eligibilityBody =
    `<p>Availability has two separate outputs: <strong>mathematical feasibility</strong> and <strong>executable readiness</strong>. A group-orbit proof can establish that a sequence exists without delivering it within the playback bound. Only a stored, independently verified primitive word makes a pair ready and bright. All pairs without a retained verified word are gray and disabled for interactive swaps. This includes feasible-but-not-ready, unchecked, and proved-impossible pairs. Backend results retain those mathematical distinctions; gray does not claim impossibility.</p>
    <p>Feasibility combines three sound sources. An exchange impossible in the full legal group remains impossible under any holds. An exchange possible while fixing every held sticker remains possible while preserving their colors. A short operation whose held endpoint colors verify proves an additional positive and can also supply its executable word. A negative from the strict held subgroup is deliberately discarded.</p>`+
    subsection('tech-color-eligibility','Merge proof bounds without treating unknown as impossible',
      code('COLOR-ELIGIBILITY', `H := persistent held addresses from the UI request
initialize all candidate pairs UNKNOWN
exclude empty poses and equal endpoints
if exemptSwapEndpoints is false: also exclude held endpoints
for each primitive or catalog operation g:
  D := held destinations whose incoming color differs from current color
  reject operation if more than two held destinations change color
  for each actual two-cycle (a b) with candidate endpoints:
    require D is empty, or exemptSwapEndpoints and D is a subset of {a,b}
    independently replay g's word and verify its complete support
    mark pair (a,b) and (b,a) FEASIBLE
    retain g's verified legal word if within witness/output byte limits
    mark only retained witnessed pairs READY
global := exact ordered-pair analysis with NO holds
          (up to 750 ms with holds; remaining request time with no holds)
copy certified global FEASIBLE for pairs whose H∖{a,b} is empty
if H is nonempty:
  copy only certified global IMPOSSIBLE pairs
  strict := exact held-point-stabilizer analysis with remaining budget
  copy only strict FEASIBLE pairs
compute firstStatus from feasibility and readyFirstStatus from readyPairs
complete iff every candidate pair is classified; otherwise partial/unknown`)+
      `<p>The website requests <code>exemptSwapEndpoints:true</code>. The persistent set H stays unchanged while evaluating candidates: each pair has its own active set F=H∖{a,b}. It is not necessary to rebuild a full table for each pair. Compute once per operation the changed-color held destinations D; that operation is acceptable for pair {a,b} exactly when D⊆{a,b}. More than two violations reject it for every pair. Without the option, holds are excluded from candidate endpoints and D must be empty. This flag is included in eligibility cache keys. To avoid per-operation Map/Set allocations, the implementation allocates five reusable length-N typed arrays for one eligibility scan: held and candidate masks (one byte each), source and destination epoch stamps (four bytes each), and destination mapping (four bytes). The total is 14N bytes, within the existing working-space estimate. Increment the epoch for each sparse operation; an entry belongs to that operation only when its stamp equals the current epoch. Clear both stamp arrays on integer wraparound. Reject repeated sources or destinations and require every moved source to appear among the destinations before using the map. Replay verification still checks all N addresses, treating unstamped addresses as fixed. Candidate ordering, output words, limits and mathematical guarantees are unchanged. The strict fallback fixes all of H, so its positive answers remain safe but need not discover choices that exempt a held endpoint; its negatives still cannot disable a relaxed choice.</p><p>The total default allowance is 3 seconds. Concrete primitive/catalog witnesses have priority. With holds present, the subsequent full-group analysis is capped at 750 ms; with no holds it can use remaining time. Sparse catalog supports are accepted only when they match replay of their legal words; a memoized validation must be invalidated if either words or support changes. Missing or mismatched catalog data removes that source of ready sequences, but primitive operations remain usable and no negative proof follows from missing data.</p>
      <p>A feasibility proof need not supply any explicit word. A ready witness supplies a legal word within the 5,000-move playback limit, but need not be shortest. Retaining the actual word avoids showing a bright choice and then rediscovering that its sequence cannot be constructed within the search budget. Catalog witnesses are collected with no holds too; global no-holds classification alone does not establish readiness. Fixed centers and odd-length cyclic orbits can still be proved impossible.</p>`)+
    subsection('tech-eligibility-pairs', 'Point orbits and complete ordered-pair orbit classification',
      `<p>This is the exact strict subroutine used twice by the wrapper above. First compute point orbits under the selected group generators. Nodes in different point orbits cannot exchange under that group. Use primitive generators for the full-group bound, or obtain held-stabilizer generators using the cached base-change method for strict positives. Under the explicit strict <code>throughout</code> backend option use only individually hold-preserving primitives. A strict held-subgroup negative must never be copied into the relaxed color table.</p>`+
      code('Classify every candidate pair under the selected subgroup', `CLASSIFY-PAIRS(S, occupied, held):
  candidates := occupied minus held
  pointOrbits := partition all N addresses into complete S-orbits
  mark pairs in different point orbits as proved infeasible
  for each point orbit C with at least two candidates:
    let n := size(C); build global<->local address maps
    actions := distinct nonidentity restrictions of S to C
    visited := n*n zero bytes; queue := array of n*n unsigned integers
    for each ordered local pair (a,b), a != b:
      if visited[a*n+b]: continue
      exhaust its diagonal-action orbit using BFS:
        (x,y) -> (action[x],action[y]) for every restricted action
      reversible := this complete orbit contains (b,a)
      only after the orbit completes:
        for every (x,y) in that orbit, if both are candidates:
          mark (x,y) and (y,x) feasible exactly when reversible
  finalize first-endpoint statuses from the pair table`)+
      `<p>Reversal J(x,y)=(y,x) commutes with the diagonal action g·(x,y)=(g(x),g(y)). Therefore if one ordered-pair orbit contains a pair and its reversal, every pair in that orbit is exchangeable. If it does not, no pair in it is exchangeable. The algorithm may also mark the reversed orbit using the same result; the visited array can still cause that orbit to be explored later. Never mark a negative from a partially explored orbit.</p>
      <p>For point-orbit sizes n₁,…,nℓ and at most s distinct restricted actions per orbit, all pair transitions cost O(s∑nᵢ²), bounded by O(sN²). The largest visited array and queue require approximately 5·max(nᵢ²) bytes; restricted actions require O(snᵢ) integer entries. Prepared full-length stabilizer data is additional. No words are expanded and no full configuration graph is enumerated.</p>`)+
    subsection('tech-eligibility-bits', 'Bit-packed result representation and partial answers',
      table(['Stored quantity', 'Dimension and interpretation'], [
        ['<code>knownPairs</code>', '⌈N²/8⌉ bytes. Bit aN+b is 1 only after that pair has been classified.'],
        ['<code>feasiblePairs</code>', '⌈N²/8⌉ bytes. A set known bit with this bit 1 means feasible; with 0 means proved infeasible.'],
        ['<code>firstStatus</code>', 'N bytes: 0 unchecked, 1 at least one feasible partner, 2 no possible partner.'],
        ['<code>readyPairs</code>', '⌈N²/8⌉ additional bytes. Bit aN+b is 1 only when the response also retains a verified, output-bounded primitive word for that pair.'],
        ['<code>readyFirstStatus</code>', 'N bytes indicating whether each first endpoint has at least one retained ready partner; separate from mathematical firstStatus.'],
        ['<code>readyWitnesses</code>', 'Bounded records {word,pairs}, where word is a primitive-index list and pairs=[a,b,…] lists unordered endpoint pairs verified for that same word. One word can serve several pairs without being duplicated.'],
        ['Candidate / occupied / protected arrays', 'Lists of current addresses; candidates exclude holds. Empty pose addresses are not selectable.']
      ])+
      code('Reading and finalizing eligibility', `PAIR-STATUS(a,b):
  i := a*N+b; byte := floor(i/8); mask := 1 << (i mod 8)
  if (knownPairs[byte] & mask) == 0: return 0  // unchecked
  if (feasiblePairs[byte] & mask) != 0: return 1
  return 2                                                // proved infeasible

FINALIZE:
  for candidate a:
    if any other candidate b has PAIR-STATUS(a,b)==1: firstStatus[a] := 1
    else if any other candidate b has status 0: firstStatus[a] := 0
    else: firstStatus[a] := 2
  result is complete if no candidate pair remains unknown
  otherwise partial if at least one pair is known, else unknown`)+
      `<p>Initialize equal-endpoint pairs, held endpoints, and noncandidate endpoints as known infeasible. Initialize other pairs as unchecked. On a resource limit, retain already certified point-orbit exclusions and completed pair orbits, then finalize. <code>complete</code> means the table is fully classified; it does not mean every pair is feasible.</p>
      <p>Browser availability caps are 3,000 ms, 48 MiB estimated storage, 2,000 strong generators, 100,000,000 counted operations, and 50,000 adjacent base swaps. Operations are checked in batches, with time checks at orbit/base boundaries too. Missing complete cache, time, storage, operation, generator, or base-swap limits preserve unknown entries. Invalid models or malformed cache structure give <code>invalid</code>.</p>`)+
    subsection('tech-goal-hints', 'Manual goal hints and persistent Auto hold guidance',
      `<p>The Hold group has a persistent policy: manual Select or Auto. Input selection is separate: choosing a Swap or Move marker changes which endpoint a click selects, without changing that hold policy. Manual Select permits hold edits and Clear. Auto disables both, retains its route between pair selections, and updates its holds after every completed guided step. Clicking Select explicitly leaves Auto while keeping the current holds; clicking an active Auto also leaves guidance, returning to manual pair selection. Display and playback settings are unaffected.</p>`+
      code('Manual white-ring predicate', `q(v) := canonical goal color at occupied home address v, if defined
c(v) := current color at occupied address v
H := marked held addresses
READY(a,b,H) := a retained legal word independently verifies the exchange
                a -> b, b -> a and the colors at H minus {a,b}
NEW-GOAL(a,b) := (q(a) exists and c(a)!=q(a) and c(b)=q(a))
                or (q(b) exists and c(b)!=q(b) and c(a)=q(b))
FIRST-GOAL-HINT(a) := exists occupied b!=a outside H:
                     READY(a,b,H) and NEW-GOAL(a,b)
SECOND-GOAL-HINT(b | a) := b outside H and b!=a:
                         READY(a,b,H) and NEW-GOAL(a,b)
// Full color still permits every READY pair, including held endpoints.
// Gray means no retained verified exchange, not proven impossible.
// Recompute hints after hold, endpoint, readiness or puzzle-state changes.
// Cache the resulting node sets; drawing a frame is not a new search.`)+
      `<p>The goal predicate is about the two exchanged endpoint colors only. Other unheld locations may become incorrect, and an endpoint match does not prove fewer turns remain. An empty hypothetical pose has no canonical goal color; it cannot supply a fictitious match. The solid white hint ring lies outside any dashed hold ring. The manual hints use the canonical underlying colors, including in mirror mode; only Auto’s declared exact/color goal determines its completion certificate.</p>
      <p>A local endpoint improvement does not prove a route to the goal. It may disturb other correct colors or reach a state with no supported improving two-way exchange. Auto therefore retains an entire independently verified solution and exposes its next incremental checkpoint. Let M be the physical tile count, K<sub>0</sub> the initial secured addresses, and w<sub>i</sub> the legal word for stage i. Each stage declares protected addresses H<sub>i</sub> and newly secured addresses Δ<sub>i</sub>. The certificate requires:</p>`+
      code('Monotonic certificate and finite completion', `K_i is a set of currently occupied, solved goal addresses
H_i = K_i
w_i restores every address in H_i at its complete endpoint
w_i solves every address in Delta_i
K_(i+1) := K_i union H_i union Delta_i
|K_(i+1)| > |K_i|
K_final = every physical home address
// Therefore at most M - |K_0| nonempty stages remain.
// Colors may substitute only under the plan's declared safe color goal.
// Shape, picture and mirror goals retain exact home poses where required.`)+
      `<p>This nested secured set supplies a discrete ranking function V<sub>i</sub>=M−|K<sub>i</sub>|. Every completed offered step strictly reduces V, which is a nonnegative integer, and the verified final checkpoint meets the goal. This is a constructive finite-completion certificate, not a heuristic estimate of remaining turns. All offered marker pairs for one stage select the same word and next state, so choosing any compatible white pair preserves the certificate. Holds can move during the primitive turns; their restoration is checked only at the complete checkpoint.</p>`+
      code('Prepare and retain the guided route', `AUTO-HOLDS-PLAN(model, snapshot):
  capture the request epoch, exact sticker-address map and model fingerprint
  baseline := solveFull(model, autoRequestFromSnapshot(snapshot), complete cache)
  require baseline.status == solved and verifyAutoPlan(model, snapshot, baseline)
  plan := makeAutoHoldsPlan(model, snapshot, baseline)
  require verifyAutoHoldsPlan(model, snapshot, plan)
  retain plan.stages, cursor=0, K=plan.initialProtectedNodes
  replace user holds with K; clear markers; show Move 1 / Move 2
  execute nothing
ON-AUTO-ON:
  select the persistent Auto hold policy; disable manual hold edits and Clear
  prepare the verified plan above; select Move 1 input
  if planning fails or is canceled: return to manual policy, no automatic retry
ON-SELECT:
  cancel any pending Auto plan and invalidate its response epoch
  discard the guided route, keep current holds, choose manual hold-edit input
ON-AUTO-OFF:
  cancel planning or discard the guided route, keep current holds
  choose manual policy and Swap 1 input
GUIDED-FIRST-HINT(a) := a is the first marker of a certified next-stage choice
GUIDED-SECOND-HINT(b | a) := (a,b) is a certified next-stage choice
// Auto never imports unrelated manual hints into its guided choices.
// While a step is executing, hold-policy controls cannot alter it.`)+
      code('Derive visible choices for one certified stage', `CERTIFIED-CHOICES(stage, snapshot):
  p := composition of the stage's legal primitive permutations
  inverseAt[t] := the current occupied source v with p(v)=t, if any
  choices := empty
  for each t in stage.newlySolvedNodes:
    a := inverseAt[t]
    skip if a is absent, a=t, or t already meets its goal before the stage
    if t is currently occupied:
      b := t
      kind := swap if p(t)=a, otherwise placement
    otherwise:
      b := first occupied v!=a outside stage.protectedNodes with p(v)!=v
      skip if no such physical participant exists
      kind := participants
    append distinct (firstNode=a, secondNode=b, sourceNode=a, targetNode=t, kind)
  if choices is empty:
    defer this stage's word and newly secured nodes into the next stage
    // This handles progress that only secures coincidental matches.
    // It does not protect every incidental color or merge visible stages.
  independently replay the accepted stage and check every secured goal
  return choices`)+
      code('Execute one certified choice', `ON-GUIDED-SECOND-MARKER(a,b):
  require (a,b) belongs to the retained next stage
  require current map, model fingerprint and request epoch still match
  require verifyAutoHoldsStage(model, snapshot, stage, K)
  retain current K; preview briefly; play stage.moveIndices in bounded chunks
  verify the engine's resulting sticker-address map and all secured goals
  K_next := K union stage.protectedNodes union stage.newlySolvedNodes
  require K subset K_next and |K_next| > |K|
  rebind held addresses K_next to their current physical occupants
  increment the retained stage cursor; clear the two markers
  keep Auto selected and choose Move 1 input
  if all stages completed: keep all goal holds; report Goal reached
  otherwise expose the next stage's certified choices immediately
  // No Auto click or replanning is required between steps.
ON-UNRELATED-STATE-CHANGE-OR-LEAVING-CONSTRAINED-SOLVER:
  discard the guided certificate; return to ordinary Swap tools
ON-PARTIAL-STOP:
  finish the current primitive turn; discard the remaining route
  clear holds and markers because the complete checkpoint was not reached`)+
      `<p><strong>Markers are honest about the operation.</strong> Auto uses Move ① and Move ②. A choice is classified as a true <code>swap</code> only if the stage permutation exchanges its endpoints. A <code>placement</code> carries the first sticker to the occupied target address but need not send the other sticker back. If a shape-changing target pose is currently empty, a <code>participants</code> choice marks two moved physical stickers and separately retains the true target address. No empty address is rendered as a selectable physical tile. Ordinary manual Swap still independently verifies an actual two-way endpoint exchange.</p>
      <p>Literal exchanges cannot provide a universal completion rule. For example, the cyclic group generated by (1 2 3) contains identity and the two 3-cycles, but no transposition. Its scrambled states are legally solvable although no two locations can be swapped. The guided placement certificate handles such cycles without weakening its secured-set invariant or mislabeling them as exchanges.</p>
      <p>A stage that only secures coincidentally correct nodes may have no visible placement to mark. Only that invisible-progress stage is joined to the next placement; ordinary visible incremental stages remain separate. The first Auto request may release incidental user holds and retain fewer than all currently correct colors. Thereafter Auto remains selected and reuses its route without another Auto click; completed guided steps never shrink K. A completed route leaves Auto selected with every goal held and no further choices. Select is required before editing or clearing holds. If planning or independent verification fails, Auto turns off without displaying speculative guided choices. A manually overridden or interrupted session requires a new plan from its current legal state. Stop during the preview pause preserves the untouched route; Stop after playback has begun clears it at the primitive boundary. The guarantee assumes the retained complete stages are followed; it does not promise that every arbitrary manual swap improves progress, nor that a bounded planning attempt always returns a route. The existing small-catalog <code>suggestHolds</code> API remains a programmatic local heuristic, but no longer drives the browser’s Auto button.</p>`)+
    subsection('tech-eligibility-ui', 'Selection updates, cache keys, and stale-result rejection',
      `<p>Before dispatch, map selected nodes to current addresses and capture the complete color array. Holds designate locations whose endpoint colors must be restored; do not let a hold follow a same-colored replacement sticker to a different location. Choosing Swap ① again clears both endpoints and leaves holds; selecting the tile for Swap ② submits the pair automatically. Changes to holds discard the previous manual solve result and recompute eligibility for the current colors. A held endpoint stays selected with a temporary exemption: the effective protected set is the held addresses minus the two current endpoints. Clearing or replacing an endpoint restores its hold immediately.</p>`+
      code('Availability scheduling and safe reuse', `ON-IDLE-SELECTION-CHANGE:
  map := current physical-sticker-ID -> address map
  fixed := sorted addresses of selected held sticker IDs
  occupied := sorted current occupied addresses
  colorByNode := color at each address, null for empty poses
  requestKey := (model,holdSemantics,fixed,occupied,colorByNode)
  stateToken := complete current sticker-address mapping
  if requestKey and stateToken equal the active request: do nothing
  increment request epoch; cancel obsolete pending work
  retain compatible prior proofs only when full colors and occupancy agree
  if exact requestKey is cached: process cached result
  else after 80 ms debounce, launch/reuse an eligibility worker

ON-RESULT(response):
  require matching epoch, still in manual selection mode, idle engine
  require same current stateToken and matching model fingerprint
  otherwise discard response
  install complete/partial/unknown result; redraw manual readiness
  in manual policy, derive local endpoint-goal hints from ready exchanges
  never add these local choices to an active Auto-guided route
  if retained witness makes endpoint/pair ready: show bright and enable
  else: show gray and disable swapping; do not claim impossibility
  before choosing endpoint 1, aggregate over its possible partners:
    bright if any partner has a stored verified witness
    otherwise gray and disable swapping
ON-SECOND-ENDPOINT-SELECTED:
  if a verified retained word is ready:
    retrieve that word for the selected pair
    require identical colors/holds/occupancy and independent verification
    wait briefly; recheck snapshot; play without launching a fresh search
  else:
    reject selection; show that no verified swap is ready
    do not launch speculative search
  if no sequence is returned:
    clear both endpoints; activate Swap ①; retain holds
    show No solution found. Try another pair.
    retain technical recovery guidance where applicable
BACKEND-API-CONTINUATION (not an ordinary UI action):
  require unchanged request, live identity snapshot and retained worker
  extend cumulative budget and resume pending work, without restarting
  if terminal resource/time limit: set canContinue=false; return typed unknown
  every non-solved result leaves the puzzle unchanged`)+
      `<p>While choosing A, use the first-endpoint feasibility and readiness arrays, never a stale B row. While choosing B with A selected, use A's corresponding pair-table rows. Helpers <code>eligibilityReady</code> and <code>eligibilityWitness</code> expose executable readiness and the retained word separately from <code>eligibilityStatus</code>. A 7,000 ms UI timeout for availability leaves unresolved choices gray; Hold remains available, and only verified-ready choices may swap. A bright first endpoint means at least one partner is ready, not that every possible B is ready.</p>
      <p>Two monotonic shortcuts remain sound for an unchanged color state and occupied set: adding color holds can preserve an already-proved negative, and removing holds can preserve an already-proved positive. This follows from constraint inclusion, not subgroup closure. A change in any donor color invalidates that reuse; an arbitrary change both adding and removing holds supports neither inference.</p>
      <p>The analyzer's normalized cache key includes <code>holdSemantics</code>, the full length-N <code>colorByNode</code>, holds, occupancy, candidates, protection, and <code>exemptSwapEndpoints</code>. Its default least-recently-used cache is 2 MiB, capped at 8 MiB, and stores complete tables. Readiness word records have a separate 2 MiB cap and share the working-memory guard; charge each record max(JSON length,128+8·(word length+pair-list length)) bytes. A ready bit must never outlive its retained word. UI table caches and manual witness caches must include the full color state, not only colors on held nodes: an unheld donor can determine reachability. Prepared strict chain data remains model-dependent and reusable independently of colors.</p>
      <p>Manual witness caches are separate: the page retains up to 1 MiB of verified solved or proved-impossible results; its worker result cache is 2 MiB. An unfinished search session is live working memory, not a result cache and not an impossibility proof. Selection or state changes destroy its frontier. Unknown results are not cached as impossibility. Reused words are independently replayed against the current color request and exact 1/2 mappings. A changed live identity snapshot during planning is rejected even when the displayed colors happen to match.</p>`);

  return {
    search: section('tech-search', 'Manual swaps: color freedom with a strict fallback', colorBody + subsection('tech-strict-search', 'Identity-hold fallback: complete specification', searchBody + searchDetails),
      'Short legal operations and color-preimage search first; an identity-preserving transporter when needed.'),
    holds: section('tech-holds', 'Arbitrary holds and ordered-pair transport', holdsBody,
      'This exact subgroup solves the strict fallback; its positive answers remain valid for color holds.'),
    eligibility: section('tech-eligibility', 'Eligibility and readiness: proof versus a sequence ready to run', eligibilityBody,
      'Bright means an executable witness is stored; gray means no verified swap is ready.')
  };
};
