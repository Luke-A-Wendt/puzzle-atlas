/* Source-aligned documentation only. No solver or puzzle state is changed. */
window.SOLVER_TECH_MANUAL = function ({section, subsection, code, math, table}) {
  const searchBody =
    `<p>The manual request specifies held addresses <var>F</var> and two distinct unheld addresses <var>a</var>, <var>b</var>. It asks for a legal permutation <var>g</var> with <var>g(a)=b</var>, <var>g(b)=a</var>, and <var>g(f)=f</var> for every <var>f∈F</var>. Other unheld stickers may move. This is a <strong>protected pair exchange</strong>, not necessarily the isolated transposition (a b). Holds are restored at the end of the complete sequence; intermediate moves may displace them.</p>
    <p>The website first tries a bounded bidirectional breadth-first search on a projected state. If that search is unresolved, it builds a stabilizer for the requested holds and transports the ordered pair. The precomputed full-solve cache is used for availability and Auto Solve; the manual witness fallback currently constructs its own chain. These are distinct routes with distinct budgets.</p>` +
    subsection('tech-search-contract', 'Request normalization and protection semantics',
      `<p>Let <var>N</var> be the permutation degree, <var>M</var> the number of legal primitive moves, <var>t=|F|</var>, and <var>q=t+2</var>. A move is a length-<var>N</var> bijective array of integers in 0…N−1. All primitive costs must equal 1. Current limits accept 2≤N≤4096 and 1≤M≤512. Move names and address IDs must be unique. Reject state-dependent legality, malformed permutations, duplicate endpoints, or an endpoint in the held set. Deduplicate and sort holds.</p>
      <p>For a model with an expanded pose domain, require the current occupied-address list: its length equals the physical sticker count, its addresses are distinct, and every selected address is occupied. This prevents selecting an empty hypothetical pose. Color equality is not used: protection refers to physical sticker identities at their selected addresses.</p>` +
      table(['Option', 'Exact meaning'], [
        ['<code>protected_swap</code> / <code>endpoint</code>', 'The interface default. Fix the explicitly held addresses at the end; exchange a and b; permit other changes.'],
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
  g := GROUP-EXCHANGE(filtered model, holds, a, b, remaining limits)
  if g is SOLVED:
    restore original move indices; retain r.lowerBound
    if g is not optimal, shortening is enabled, protection != throughout,
       and more than 10 ms remain:
      shorten without changing the permutation, for min(150 ms,time left)
    if length(g.word) == r.lowerBound: g.optimal := true
  finish(g): enforce output length; independently replay and verify
             the endpoint constraints before publishing a witness`)+
      table(['Browser manual solver bound', 'Go', 'Try longer'], [
        ['Total algorithm time', '3,000 ms', '10,000 ms'],
        ['Projected BFS time', '450 ms', '1,500 ms'],
        ['Projected BFS stored records / depth', '15,000 / 12', '15,000 / 12'],
        ['BFS estimated storage ceiling', '32 MiB', '32 MiB'],
        ['Group estimate / generators / word-DAG nodes', '48 MiB / 2,000 / 100,000', 'Same'],
        ['Orbit records / Schreier tests / expanded output moves', '100,000 / 3,000,000 / 5,000', 'Same']
      ])+
      `<p>These are website defaults, not claims that every request fits them. The browser wrapper permits at most 25,000 BFS records and depth 30 when explicitly requested; the normal and longer-search buttons do not increase those two defaults. Its worker response timeout is total time +1,000 ms. Backend <code>solveSync</code> defaults differ: 500 ms/25,000 records for the short search and 64 MiB group storage. The standalone threaded API also enforces a worker heap limit and a total time +500 ms timeout.</p>
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
      `<p>Availability checks need reachability, not a move word. They reuse the precomputed chain and reorder its base so the requested held addresses come first. This avoids recomputing a Schreier–Sims chain for every selection. The cached implementation stores a full base of N distinct addresses, even though a shorter mathematical base can suffice. Its certified level sizes d<sub>k</sub>=|H<sub>k</sub>·b<sub>k</sub>| satisfy |H<sub>k</sub>|=d<sub>k</sub>|H<sub>k+1</sub>|.</p>
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
      <p>This route stores full length-N representatives while reordering; it is not merely sorting labels. A representative orbit of size o requires O(oN) permutation entries. Generator composition costs O(N), and repeated orbit recomputation costs O(o·s) transitions each time. There is no promise that every arbitrary held subset fits the current budget, but its cost depends on points, generators, and base changes—not on explicitly storing every puzzle configuration.</p>`);

  const eligibilityBody =
    `<p>Availability is a separate bounded calculation. It classifies many exchanges under the same holds at once, without expanding move words. A proved reachable pair may still take longer than the manual witness budget to produce or may require an output longer than 5,000 moves. Conversely, a timeout means unchecked, not impossible. The interface dims only choices proved unavailable.</p>`+
    subsection('tech-eligibility-pairs', 'Point orbits and complete ordered-pair orbit classification',
      `<p>First compute point orbits under the legal primitive generators. Nodes in different point orbits cannot exchange under any subgroup, so record those negatives immediately. Then obtain the held stabilizer generators using the cached base-change method above; with no holds use the primitive generators directly, and under throughout semantics use only individually hold-preserving primitives.</p>`+
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
    subsection('tech-eligibility-ui', 'Selection updates, cache keys, and stale-result rejection',
      `<p>Selection is stored as physical sticker IDs. At every idle snapshot, the adapter converts them to current addresses. A and B are independent editable slots; the other selected endpoint stays in place while one is changed. Adding a selected endpoint to the held set clears only that slot. Changes to holds discard the previous manual solve result and recompute eligibility; they do not silently reuse a verdict for a different constraint set.</p>`+
      code('Availability scheduling and safe reuse', `ON-IDLE-SELECTION-CHANGE:
  map := current physical-sticker-ID -> address map
  fixed := sorted addresses of selected held sticker IDs
  occupied := sorted current occupied addresses
  requestKey := (fixed,occupied)
  stateToken := complete current sticker-address mapping
  if requestKey and stateToken equal the active request: do nothing
  increment request epoch; cancel obsolete pending work
  retain prior proofs only when occupied-address sets agree
  if exact requestKey is cached: process cached result
  else after 80 ms debounce, launch/reuse an eligibility worker

ON-RESULT(response):
  require matching epoch, still in manual selection mode, idle engine
  require same current stateToken and matching model fingerprint
  otherwise discard response
  install complete/partial/unknown result; redraw selection states
  dim/reject only status 2; leave status 0 selectable
  enable Go when distinct A and B exist and their pair is not status 2`)+
      `<p>Before A is chosen, use <code>firstStatus</code> to dim nodes having no partner. After either endpoint is chosen, use that endpoint’s pair-table row for the other slot. Clicking an endpoint’s card changes which slot is being edited. Unknown choices stay selectable, and Go performs the bounded witness search. A 7,000 ms UI timeout for availability returns unchecked rather than blocking interaction.</p>
      <p>There are two sound monotonic shortcuts while replacement results are pending. Adding holds shrinks the stabilizer, so a previously impossible pair remains impossible. Removing holds enlarges it, so a previously feasible pair remains feasible. Apply these only to the same address pair and the same occupied-address set. An arbitrary change that both adds and removes holds supports neither inference. The implementation also uses the corresponding safe first-endpoint statuses with candidates drawn from those compatible sets.</p>
      <p>The analyzer caches complete tables under the model signature and normalized request (holds, occupancy, candidates, protection semantics). Its default least-recently-used cache is 2 MiB, capped at 8 MiB. The UI separately retains complete or partial tables under holds plus occupancy, capped at 2 MiB and scoped to the loaded model; it preserves only entries whose bits already prove a result. It maps those address results back through the fresh sticker-ID map, so a change in sticker identities does not corrupt address reachability. The prepared chain is invalidated when its cache object changes.</p>
      <p>Manual witness caches are separate: the page retains up to 1 MiB of verified solved or proved-impossible results keyed by normalized holds, ordered pair, and occupancy. The browser worker has a 2 MiB result cache keyed by model ID, normalized request, and options. Unknown results are not cached as impossibility. Every reused witness is independently verified against the current request before playback, and a state change during search causes rejection rather than execution on a stale configuration.</p>`);

  return {
    search: section('tech-search', 'Manual swaps: bounded exact search', searchBody + searchDetails,
      'A small exact search first; a stabilizer transporter when the short search cannot finish.'),
    holds: section('tech-holds', 'Arbitrary holds and ordered-pair transport', holdsBody,
      'A subgroup fixes the holds; a small pair orbit decides whether both endpoints can exchange.'),
    eligibility: section('tech-eligibility', 'Eligibility: proved available, proved unavailable, or unchecked', eligibilityBody,
      'Availability proofs are reusable; unknown choices remain selectable.')
  };
};
