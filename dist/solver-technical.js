/* Reproducible specification of the shipped solver; presentation only. */
(() => {
'use strict';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chapterNumbers={'tech-model':1,'tech-chain':2,'tech-search':3,'tech-holds':4,'tech-eligibility':5,'tech-full':6,'tech-shorten':7,'tech-runtime':8,'tech-reproduce':9};
const chapterTitle=(id,title)=>chapterNumbers[id]?chapterNumbers[id]+' · '+title.replace(/^\d+\s*·\s*/,''):title;
const section=(id,title,body,summary='')=>'<details class="solver-tech-section" id="'+esc(id)+'"><summary>'+esc(chapterTitle(id,title))+'</summary><div class="solver-tech-body">'+(summary?'<p class="solver-tech-lead">'+summary+'</p>':'')+body+'</div></details>';
const subsection=(id,title,body,summary='')=>'<details class="solver-tech-subsection" id="'+esc(id)+'"><summary>'+esc(title)+'</summary><div class="solver-tech-body">'+(summary?'<p>'+summary+'</p>':'')+body+'</div></details>';
const code=(title,text)=>'<figure class="solver-pseudocode"><figcaption>'+esc(title)+'</figcaption><pre tabindex="0" aria-label="'+esc(title)+'"><code>'+esc(text.trim())+'</code></pre></figure>';
const math=(label,body)=>'<div class="solver-equation"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" aria-label="'+esc(label)+'">'+body+'</math></div>';
const table=(headers,rows)=>'<div class="solver-tech-table" tabindex="0"><table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const link=(id,label)=>'<a class="solver-tech-jump" href="#'+id+'">'+label+'</a>';

function foundations(){return section('tech-model','1 · State, permutations, inputs & conventions',`
<p>The solver consumes a finite <strong>permutation model</strong> exported from the game engine. It does not infer the puzzle mechanics from drawn ring intersections. Rings visualize the engine’s moves; the move arrays are the authoritative input. This distinction lets the same algorithm work with cubes, polyhedra, and shape-changing pose domains.</p>
${subsection('tech-notation','Symbols, dimensions and the three different meanings of “state”',table(['Symbol','Definition and size'],[
 ['<i>Ω</i>, <i>N</i>','Address set Ω = {0,…,N−1}; N is the permutation degree.'],
 ['<i>K</i>, <i>s</i>','K physical sticker identities. s[id] is the current address of that sticker; s has K entries and is injective.'],
 ['<i>h</i>, <i>O</i>','h[id] is its fixed home address. O = image(s) is the current occupied set, with |O| = K.'],
 ['<i>m</i>, <i>p</i><sub>j</sub>','m allowed nonidentity primitive moves; pⱼ is a source→destination array of N integers. All exported costs are 1.'],
 ['<i>P</i><sub>j</sub>','N×N permutation matrix with Pⱼ[pⱼ[q],q] = 1. It is explanatory notation; no dense matrices are stored.'],
 ['<i>G</i>, <i>F</i>','G = ⟨p₀,…,pₘ₋₁⟩; F⊆Ω is the set of held addresses at request time.'],
 ['<i>a</i>, <i>b</i>','Distinct unheld occupied addresses of the selected A and B identities.'],
 ['<i>w</i>, <i>L</i>','Chronological primitive-index list w = [j₀,…,jL−1]; L is its cost/length.'],
 ['<i>b</i><sub>i</sub>, <i>H</i><sub>i</sub>, <i>T</i><sub>i</sub>[q]','Base address at level i; subgroup fixing the first i base addresses; a representative sending bᵢ to q. Base indices start at 0.'],
 ['<i>r</i>','Number of base levels. The shipped caches use a full N-address base, including trivial levels; a mathematical minimal base need not have N entries.']
])+`<p>Do not confuse <strong>s</strong> (K sticker positions), <strong>g</strong> (one N-address transformation), and a probability or one-hot vector over <strong>all configurations</strong>. We store the first two. A transformation can be represented without enumerating the configurations on which it acts.</p>
<p>For fixed-slot puzzles K=N. For shape-changing models K≤N: many possible addresses are empty at a given moment. Empty addresses are model coordinates, not extra puzzle stickers or extra ring-map dots.</p>
${table(['Example','N addresses','K stickers','m moves'],[['2×2×2','24','24','18'],['3×3×3, including M/E/S slices','54','54','27'],['8×8×8','384','384','72'],['Master Pyraminx','64','64','24'],['Kilominx','60','60','48'],['Ghost Cube','168','61','18'],['Diamond Puzzler','26','26','18'],['Diamond Cuboctahedron','86','86','18'],['Flat Diamond','254','68','18'],['Pyramorphix','32','16','18'],['MasterMorphix','80','40','18']])}
<p>Identity-solved means s[id]=h[id] for every id. Color-solved is weaker: equal-color stickers may be interchangeable visually. A single-color center’s hidden in-plane orientation is not represented by center/normal coordinates. All exactness claims refer to the exported address model, including that modeling boundary.</p>`)}
${subsection('tech-composition','Composition order, matrices, inverses and words',`
<p>Mathematical juxtaposition applies the rightmost permutation first: (gh)(q)=g(h(q)). Pseudocode uses <code>THEN(p,q)</code> for chronological execution of p followed by q, so <code>THEN(p,q)[x]=q[p[x]]</code>. The group engine’s helper named <code>compose</code> implements THEN; the exporter has a differently ordered helper. Reproduce the explicit formulas here rather than assuming identical helper names have identical conventions.</p>
${math('The permutation of a chronological word is the last move times the previous moves through the first move','<mrow><mi>π</mi><mo>(</mo><mi>w</mi><mo>)</mo><mo>=</mo><msub><mi>p</mi><mrow><msub><mi>j</mi><mrow><mi>L</mi><mo>−</mo><mn>1</mn></mrow></msub></mrow></msub><mo>∘</mo><mo>⋯</mo><mo>∘</mo><msub><mi>p</mi><msub><mi>j</mi><mn>0</mn></msub></msub></mrow>')}
${code('Foundational array operations',`IDENTITY(N): return [0,1,...,N-1]
THEN(p,q): return [q[p[x]] for x in 0..N-1]
INVERSE(p):
    out := array(N)
    for x in 0..N-1: out[p[x]] := x
    return out
EVAL(word):
    g := IDENTITY(N)
    for j in word: g := THEN(g, moves[j].perm)
    return g
INVERSE_WORD(word):
    return [moves[j].inverse for j in reverse(word)]
APPLY_TO_IDENTITIES(s, g):
    return {id: g[s[id]] for id in identities}
APPLY_TO_SLOT_VALUES(x, p):
    next := array(N)
    for q in 0..N-1: next[p[q]] := x[q]
    return next`)}
<p>Permutation composition and inversion cost O(N) time and O(N) output memory. INV and INVERSE are synonyms for that same inverse-array operation. Applying a known permutation to current sticker positions costs O(K). EVAL costs O(LN). Values x may be colors or identities; the solver uses identities. Pⱼ<sup>−1</sup>=Pⱼ<sup>T</sup>, but an integer inverse array is simpler than a matrix transpose.</p>
<p>Chronological concatenation satisfies π(u followed by v)=π(v)∘π(u). Inverting a word reverses its order <em>and</em> replaces every move by its inverse. Half turns may be their own inverse. Each inverse must have an allowed primitive index, or be expanded as a finite positive power with an explicit output bound.</p>`)}
${subsection('tech-contract','Model schema and request contracts',`
${code('Minimal serializable model',`model = {
  schemaVersion: 1, id: stablePuzzleId,
  supported: true, fixedPermutation: true,
  degree: N, stickerCount: K,
  nodeIds: N unique strings,
  nodes: N address descriptors,
  moves: [
    {name, perm: N integers, inverse: moveIndex,
     engineMove: {face,dir,turns}, cost: 1, axis, power}
  ],
  initialOccupied: K distinct addresses,
  homeBySticker: {stableStickerId: homeAddress},
  requiresOccupiedState: boolean,
  adapter: {representation, sourceToDestination: true,
            keyPrecision: 1e-7, supportedMode, source}
}`)}
<p>Require 2≤N≤4096; 1≤m≤512; unique move names and node IDs; each permutation has exactly N distinct integers in [0,N). Only unit move costs are accepted. Validate that every inverse is actually inverse, and every engine command is tied to its own verified array. Shape-dependent legality cannot be repaired by merely declaring a move array. The backend exporter writes the geometric model; the browser bundler adds homeBySticker from the current engine’s solved snapshot.</p>
${table(['Request','Required endpoint condition'],[
 ['UI protected swap','g(a)=b, g(b)=a, and g(f)=f for all f∈F. Other addresses may move.'],
 ['API exact_swap','Same exchange, with F set to all other occupied addresses. In an expanded domain, empty poses are free.'],
 ['API protection=throughout','Filter primitives to those fixing every f∈F individually, then solve using only that alphabet. This is invariance at every primitive move boundary in the represented model; it does not certify unrepresented continuous motion. The UI uses endpoint protection.'],
 ['Auto Solve','g(s[id])=h[id] for every physical identity. Solve this by successive placements, not by requiring a pair exchange at every stage.']
])}
<p>A user selection is stored as physical sticker IDs, then mapped to current addresses when Go is pressed. Deduplicate and sort F; reject a=b, overlap between F and {a,b}, unoccupied selections, duplicate identities, and duplicate occupied addresses. The pure request normalizer reports these as invalid; it is not a puzzle reachability proof.</p>`)}
${subsection('tech-export','Build move permutations from a puzzle engine',`
<p><strong>Fixed slots.</strong> Record every solved address using the engine’s slot ID or a geometric key. Reset, apply one legal axis turn, and locate every sticker’s destination by its identity. The resulting array must be a bijection. A key uses center and normal, each rounded to an integer after multiplying by 10<sup>7</sup>; normalize negative zero to zero. This is numerical keying, not a fuzzy nearest-neighbor match.</p>
${code('Export fixed-slot moves and all nonidentity powers',`slots := solved address descriptors
lookup := exact keys of slots -> indices
home := locate each solved physical sticker
for each independent legal axis c:
    reset engine; apply one positive c turn
    p[home[id]] := lookup[key(currentSticker(id))]
    require p is bijective
    order := smallest positive d with p^d = I
    for e in 1..order-1:
        signed := e if e <= order/2 else e-order
        emit permutation p^e, cost 1,
             command(c, sign(signed), abs(signed))
for each emitted move j:
    inverse[j] := index of matching inverse permutation
    require inverse[j] exists`)}
<p>The exporter bounds its move-order loop at 60. All nonidentity powers of one axis cost one, including a half turn. Thus “shortest” always refers to this alphabet, not necessarily quarter-turn distance or physical elapsed time. Different cut depths are different axes in the exported alphabet.</p>
<p><strong>Ghost attachments.</strong> Ghost Cube uses an exact 168-address action for its 61 physical colored patches. A patch carries a canonical oriented attachment: its center field is the mechanical piece position and its normal field is a reference direction selected to match the solved shell color group. Corner/edge attachments use cardinal directions; center references that would be parallel to their axis receive a transverse component. Every attachment direction is nonparallel to the piece position. The pair uniquely identifies the piece orientation under the 24 cube rotations. These vectors are logical references, not measured polygon centroids/normals; 3D rendering uses the separate physical mesh. The same pose-closure and occupied-address algorithms apply. The visual layer-alignment phase does not change the permutation state.</p>
<p><strong>Expanded poses.</strong> A shape-changing sticker may have no solved-slot address after a move. Generate the closure of <em>single-marker poses</em> instead of entire configurations. A pose is the tuple (piece position, sticker center, sticker normal). Starting from solved markers, apply every base axis transform until no new pose appears. Each transform tests whether that piece position is on the selected side, and either rotates all three vectors with the engine’s exact matrix or leaves them unchanged.</p>
${code('Finite marker-pose closure',`nodes := []; index := empty key->address map
INSERT(pose):
    k := rounded key(position, center, normal)
    if k absent: index[k] := nodes.length; nodes.append(pose)
    return index[k]
for sticker in solvedSnapshot: INSERT(pose(sticker))
i := 0
while i < nodes.length:
    for axis in baseAxes: INSERT(NEXT_POSE(nodes[i], axis))
    i := i+1
    if nodes.length exceeds domain limit: abort export
for axis in baseAxes:
    p := [index[key(NEXT_POSE(q,axis))] for q in nodes]
    require p is bijective
emit all nonidentity powers as above
initialOccupied := [index[key(pose(s))] for s in solvedSnapshot]`)}
<p>For the shipped shape engine, an ordinary side is affected when <code>position[axis]×sign&gt;0</code>; a separate tip uses <code>position[axis]×sign=2</code>. These predicates are puzzle-specific input, not a rule for arbitrary new mechanisms. Export refuses a closure larger than 5,000 addresses; runtime additionally requires N≤4096. Unsupported domains fail rather than silently dropping poses.</p>
<p>Validate every emitted move against the real engine, then independently compose four seeded 40-turn sequences and compare after every turn. A mapping that works only in the solved state is insufficient. Require closed, state-independent legal transformations. Helicopter jumbling fails this assumption and is explicitly rejected; the supported Helicopter model uses normal half turns only.</p>`)}
${subsection('tech-snapshot','Map a live snapshot without trusting colors or screen coordinates',code('Snapshot-to-address mapping',`MAP_SNAPSHOT(model, snapshot):
    require not snapshot.animating
    reject unsupported jumbling / fractional alignment states
    require exactly K physical stickers
    stickerToNode := {}; nodeToSticker := {}
    for sticker in snapshot:
        if expanded:
            q := lookup(position, center, normal)
        else if geometric pose exists:
            q := lookup(center, normal)
        else:
            q := lookup(engine slot ID)
        require q exists and ID and q are both unused
        stickerToNode[ID] := q; nodeToSticker[q] := ID
    require home identities match current identities for Auto Solve
    return stickerToNode, nodeToSticker, occupied addresses`)+`<p>A well-formed mapping can still be unreachable by legal moves; group computation decides that separately. Camera orientation, canvas x/y, node radius, and color palette do not affect this mapping. For expanded poses never interpret <code>stickerState.slot</code> as a destination merely because the property exists.</p>`)}
`,'Start here before implementing a search, a stabilizer chain, or a cache.');}

function runtime(){return section('tech-runtime','8 · Verification, workers, playback & resource limits',`
<p>A planner returns a candidate word or staged plan. The UI accepts it only after independent array replay. Mathematical verification happens before animation; physical-engine comparison happens during execution. Neither a worker’s <code>verified</code> flag nor a progress bar is a proof by itself.</p>
${subsection('tech-verify','Independent manual and complete-plan verification',code('Verify a manual witness',`VERIFY_SWAP(model, request, word):
    require each index is an allowed primitive
    require length(word) <= output cap
    g := EVAL(word)
    require g[a]=b and g[b]=a
    require g[f]=f for each f in F
    if protection=throughout:
        require moves[j].perm[f]=f for every j in word, f in F
    return true`)+code('Verify an Auto Solve plan, independently of its planner',`VERIFY_PLAN(plan, snapshot):
    require status=solved; map snapshot to current[id]
    home := validated homeBySticker; locked := empty set
    validate initialProtectedNodes are occupied homes already correct
    locked := initialProtectedNodes; flat := []
    for stage in plan.stages:
        require held/new sets contain distinct valid home addresses
        require stage.target is a home address
        require stage.source = current[identityWhoseHomeIs(target)]
        require locked subset of stage.held
        require all stage.held homes currently correct
        g := EVAL(stage.word); flat.append(stage.word)
        require total flat length <= 20000
        require g fixes every stage.held address
        require g[stage.source] = stage.target
        current := APPLY_TO_IDENTITIES(current,g)
        require target is included in stage.newlySolved
        require every stage.newlySolved home now correct
        locked := locked union stage.held union stage.newlySolved
    require flat exactly equals plan.moveIndices in order
    require every current[id] = home[id]
    validate optional finalProtectedNodes is the full home set
    return true`)+`<p>This check does not rely on the group planner’s internal strong generators. Its inputs are only the authoritative primitive permutations, the snapshot, the home target, and the claimed word. A zero-stage plan is valid only when all requested identities are already home.</p>`)}
${subsection('tech-worker','Dispatch, stale-result protection and trusted assets',`
<p>The browser loads only the selected puzzle’s model. Two frozen models are retained in an LRU cache. Build-time fingerprints pin the exact model and full-cache JSON bytes; WebCrypto SHA-256 verification is performed when available. Without WebCrypto, schema/signature checks remain but byte-level cryptographic verification is unavailable. Hashes detect mismatched assets; they do not prove group-theoretic completeness.</p>
${code('Worker protocol and main-thread acceptance',`START(request):
    require idle live engine
    display loading status immediately; allow cancellation
    model := load and validate current puzzle model
    before := MAP_SNAPSHOT(model, engine.snapshot())
    token := sorted serialization(before.stickerToNode)
    epoch := epoch + 1; myEpoch := epoch
    send worker {id:myEpoch, modelId, task, snapshot, options}
    start task-specific external timeout
ON_PROGRESS(reply):
    ignore stale id or a canceled request
    display loading-model / loading-cache / planning / verifying
    reset watchdog: 24 seconds per loading stage
        or planning budget + 12 seconds for planning/verifying
ON_RESULT(reply):
    ignore if reply.id != epoch or UI no longer awaiting result
    terminate worker and its timer
    require live engine idle and live mapping token = token
    require returned fingerprint, if present, matches model
    require a recognized result status
    if solved:
        independently VERIFY_SWAP or VERIFY_PLAN
        create playback job using locally known engineMove commands
    else:
        display status; execute nothing
CANCEL_OR_CHANGE_STATE:
    increment epoch; terminate worker/timer
    discard outstanding plan and eligibility response`)}
<p>Manual Go dispatches bounded search then an on-demand group fallback. Auto Solve dispatches cached stabilizer placements. Eligibility uses a separate background worker and its own generation counter, so a delayed result for old holds cannot dim the new selection. Full-solve requests intentionally strip the move history.</p>
<p>Each asset load has a 20-second watchdog covering download and asynchronous verification, with AbortController cancellation when available. Synchronous parsing cannot be preempted by its own event-loop timer. The main thread also watches worker progress: 24 seconds per loading stage, then the requested planning budget plus 12 seconds for planning or verification. Loading and worker failures preserve diagnostic codes and messages; Retry starts a new request with a 30-second planning budget. Cancellation advances the request generation, so a late load or worker reply cannot resume playback.</p>
<p>The full-solve loader checks schema, degree, <code>status=ready</code>, <code>complete=true</code> and model signature. Base and representative structure are validated in the build/audit pipeline and eligibility preparation. Completeness is established during precomputation and audited offline; solveFull does not revalidate every structural invariant or recompute closure on every click. The final witness is still checked on every solve.</p>`)}
${subsection('tech-playback','Transactional playback, secured prefixes and interruption',code('Execute one verified constrained stage',`RUN_STAGE(stage):
    expected := current live identity->address mapping
    original := copy(expected); offset := 0
    while offset < length(stage.word):
        require engine idle and live mapping = expected
        chunk := next at most 300 primitive indices
        predicted := copy(expected)
        for j in chunk:
            predicted := APPLY_TO_IDENTITIES(predicted,moves[j].perm)
        require engine accepts corresponding engineMove commands
        wait until this chunk completes
        require live mapping = predicted
        expected := predicted; offset += length(chunk)
    verify held addresses and requested destinations at stage end
    if Auto Solve:
        lock protected plus newlySolved homes
        pause 500 milliseconds before next stage
    if stopAfterStep: return to Turn rings
    else continue to next verified stage`)+`<p>A chunk boundary is not necessarily a stabilizer boundary. Holds are guaranteed at the end of the <em>complete stage</em>, which can span many chunks. Stop during Auto Solve lets the current stage finish. Hiding the ring map can abort playback sooner; no restoration guarantee is claimed for that partial stage. Every completed primitive remains a legal move. An external move or model mismatch aborts subsequent playback rather than continuing a stale plan.</p>
<p>Progress has two meanings: secured home identities/total identities, and completed primitive turns/current stage length. Currently correct identities beyond the secured prefix are not automatically protected. Manual execution clears A/B, resets the target to A, refreshes eligibility for the current held identities, and keeps those holds afterward; successful Auto Solve returns to the default Turn rings mode. Fast/Normal speed changes affect animation, not word cost, proofs, or search depth.</p>`)}
${subsection('tech-budgets','Actual limits, memory estimates and result semantics',table(['Execution context','Current settings'],[
 ['Manual Go / longer retry','3,000 / 10,000 ms planning; 450 / 1,500 ms short search; at most 5,000 output moves. UI timeout adds 1,000 ms.'],
 ['Auto Solve / longer retry','15,000 / 30,000 ms planning; at most 20,000 output moves. UI watchdog adds 12,000 ms for loading/verification overhead.'],
 ['Eligibility','3,000 ms computation, 48 MiB estimated storage, 100 million counted operations, 50,000 adjacent base swaps. UI has its own cancellation/watchdog.'],
 ['Standalone solveSync group defaults','2,000 strong generators, 100,000 DAG nodes, 100,000 orbit states, 3 million Schreier tests, 64 MiB estimated storage.'],
 ['Standalone solveSync short-search defaults','25,000 visited-state budget, depth 12, at most 32 MiB estimated storage; no full-configuration table.'],
 ['Browser manual overrides','15,000 short-search states and 48 MiB group-storage estimate; other bounds are clamped in the worker.'],
 ['Main-thread small caches','Manual results: 1 MiB estimated serialized text. Eligibility: 2 MiB. Unknown results are not retained as impossibility proofs.'],
 ['Optional Node service','Up to three resident model solvers, each with an 8 MiB result cache. Worker old heap defaults to 192 MiB plus 16 MiB young heap; external timeout adds 500 ms.']
])+`<p>MiB means 2<sup>20</sup> bytes. Browser JavaScript object/array overhead varies; these storage counters are safeguards and estimates, not an enforced heap quota. A browser Worker prevents blocking the main thread, but does not itself prove bounded memory. Node’s worker heap limit is a separate mechanism. Offline precomputation uses different, larger puzzle-specific budgets detailed in the cache chapter.</p>
${table(['Status','What is justified'],[
 ['solved','A legal word satisfies the requested constraints, verified by replay. This alone says nothing about minimum length.'],
 ['impossible','A complete orbit/search argument excludes the request under this model and move alphabet. A computation limit is never such a proof.'],
 ['unknown (UI: Unresolved)','Time, storage, output length, expansion, worker availability, or another bounded computation prevented a conclusion. The puzzle may be solvable.'],
 ['invalid','Malformed request, unsupported mechanics/state, inconsistent identities, or an unusable model/cache contract. This is not a legal-group impossibility theorem.'],
 ['optimal=true','Certified minimum unit-cost length: completed shortest-search proof, no-holds primitive pair-orbit BFS, or a verified word meeting a valid lower bound. An already-solved zero-move target is trivially optimal. Nontrivial cached Auto Solve does not claim it.']
])}`)}
`,'Treat planning and execution as separate, independently checked operations.');}

function reproduction(){return section('tech-reproduce','9 · Reproduction checklist, worked fixtures & scaling',`
${subsection('tech-fixtures','Small complete examples to test the conventions',`
<p>Use Ω={0,1,2,3} and the adjacent transpositions A=[1,0,2,3], B=[0,2,1,3], C=[0,1,3,2]. These three unit-cost moves are their own inverses. They generate S₄. With base [0,1,2,3], a complete chain has orbit sizes 4,3,2,1 and group order 24.</p>
${code('A protected swap with a known answer',`F = {0}; a = 1; b = 3
word = [B,C,B]
after B: [0,2,1,3]
after C: [0,3,1,2]
after B: [0,3,2,1]
assert EVAL(word)[0] == 0
assert EVAL(word)[1] == 3
assert EVAL(word)[3] == 1`)}
<p>Those arrays show the destination of each original address after each prefix. One primitive cannot exchange 1 and 3; two transpositions have even parity while the desired isolated exchange is odd. Here holding 0 and exchanging 1/3 also forces address 2 to remain, so the three-move solution is shortest. This is a small test fixture, not a general shortcut for puzzle requests with collateral motion.</p>
<p>For an impossible fixture, use only the nonidentity powers of R=[1,2,3,0]. Its group is cyclic of order 4. Holding address 0 leaves only identity, so exchanging 1 and 3 is impossible. Exhausting that held subgroup’s pair orbit proves it. Interrupt the same calculation before completeness and the expected status is unknown, not impossible.</p>
<p>For partial occupancy, use the same four-address cycle with only two labeled markers initially at 0 and 2. Current mapping {A:1,B:3}, home {A:0,B:2} is solved by R<sup>−1</sup>. Addresses 1 and 3 are not permanent stickers. Do not add fictitious identities to fill them.</p>`)}
${subsection('tech-validation','Build and validate in this order',`<ol>
<li><strong>Define mechanics.</strong> Implement exact primitive engine transforms and stable marker identities. Decide which orientation information the model represents.</li>
<li><strong>Export the address domain.</strong> Fixed slots or single-marker pose closure; every primitive must be a state-independent bijection.</li>
<li><strong>Validate conventions.</strong> Identity, inverse, move order, matrix/array agreement, chronological concatenation, and the fixtures above.</li>
<li><strong>Implement bounded tuple search.</strong> Test full-layer stopping, inverse reconstruction, exhausted components, and limits at each layer boundary.</li>
<li><strong>Implement words, orbits, sifting, and Schreier closure.</strong> Check every stored representative fixes the earlier base and sends the current base to its advertised destination. Check generator words by independent primitive replay.</li>
<li><strong>Certify complete caches.</strong> Close all Schreier residues; never mark a timed-out build complete. Serialize only valid reachable word nodes. Reload and recheck signatures and representatives.</li>
<li><strong>Implement held-set and ordered-pair work.</strong> Test a pair whose points share a single-point orbit but cannot exchange simultaneously. Test throughout protection separately from endpoint protection.</li>
<li><strong>Implement cached full placement.</strong> Test states without a move journal and partial-occupancy domains. Check every secured prefix after every whole stage.</li>
<li><strong>Implement availability as tri-state.</strong> Interrupt analyses mid-orbit; retain unknown choices, invalidate on held-set/state changes, and reject stale epochs.</li>
<li><strong>Integrate independent verification and playback.</strong> Reject forged moves, missing identities, stale model fingerprints and state changes. Test sequences longer than 300 moves across chunk boundaries.</li>
<li><strong>Check the actual engine.</strong> Replay each returned word in the physical simulator, including mixed multi-axis scrambles; array self-consistency alone cannot validate a wrong exported move model.</li>
<li><strong>Optimize last.</strong> Shorten words and refine representatives, then repeat the same independent checks. Rewriting an existing witness requires an identical full permutation. Replacing a cache representative may change its full permutation, but must preserve its base-prefix fixation and advertised base-point image; its new word must match its own stored permutation, retain complete orbit coverage, and pass the refinement checks.</li>
</ol>`)}
${subsection('tech-scaling','What grows, and what never needs to be allocated',table(['Object / operation','Size or cost'],[
 ['Primitive move arrays','O(mN) integers; a single dense matrix would be O(N²), and m such matrices O(mN²).'],
 ['Current / home sticker mappings','O(K) entries each.'],
 ['Search tuple of t=|F|+2 identities','O(t) per visited tuple. At most N!/(N−t)! distinct injective tuples exist, but the bounded search retains only its permitted budget.'],
 ['Ordered-pair domain','N(N−1) meaningful pairs; bitsets allocate N² positions for simple indexing. Two bitsets use about N²/4 bytes, before queues, arrays and generators.'],
 ['One representative as a full permutation','O(N) integers, plus a small word-DAG reference. Storing all ≤N representatives at each of r levels is O(rN²) integers in the worst case.'],
 ['Word graph versus expanded word','D DAG nodes can describe a word far longer than D. Explicit playback still requires L moves and at least Ω(L) work; expansion must be bounded.'],
 ['All possible held sets','2ᴺ subsets exist; the implementation does not precompute a solver for every subset.'],
 ['Configuration graph','Neither its nodes nor its edge-flow LP are allocated. Local tuple/pair orbits and stabilizer representatives replace that global representation.']
])+`<p>For the 8×8, the primitive array payload is 72×384=27,648 integer entries; its complete serialized solve cache is about 5.17 MB. This is much smaller than enumerating puzzle configurations, but does not make shortest-word factorization trivial. Permutation-group structure makes reachability and constructive factorization practical here; representative lengths and arbitrary-hold computations can still grow, hence explicit limits.</p>
<p>The detailed chapter pseudocode specifies the invariant and loop structure; deterministic tie-breaking, hash-map implementation, object layout, and display timing may produce different verified words in another implementation. Reproducing the algorithm and guarantees does not require byte-identical cache files or the same nonoptimal solution sequence.</p>`)}
`,'Use these fixtures and invariants before trying a large puzzle.');}

function render({cite}){
 const helpers={section,subsection,code,math,table,cite};
 const group=window.SOLVER_TECH_GROUP(helpers),manual=window.SOLVER_TECH_MANUAL(helpers);
 const contents=[['tech-model','State & conventions'],['tech-chain','Stabilizer precomputation'],['tech-search','Bounded shortest search'],['tech-holds','Held nodes & pair transport'],['tech-eligibility','Availability checks'],['tech-full','Auto Solve placements'],['tech-shorten','Shortening & caches'],['tech-runtime','Verification & execution'],['tech-reproduce','Reproduce & validate']];
 return '<div class="solver-technical"><div class="solver-tech-intro"><h4>Implementation specification</h4><p>The chapters below describe the shipped algorithms, including their data structures, stopping rules and failure cases. Start with the conventions: reversing a composition is the easiest way to build a solver that appears plausible but moves the wrong stickers.</p><nav class="solver-tech-nav" aria-label="Technical solver chapters">'+contents.map(([id,title])=>link(id,title)).join('')+'</nav><p class="solver-guide-note">Expand only the level of detail you need. Pseudocode blocks scroll horizontally; equations use native MathML. “Exact” means a verified answer under the move model, not a guaranteed shortest answer.</p></div>'+foundations()+group.chain+manual.search+manual.holds+manual.eligibility+group.full+group.shorten+runtime()+reproduction()+'</div>';
}
window.SOLVER_TECHNICAL=Object.freeze({render});
})();
