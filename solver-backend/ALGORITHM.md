# Exact constrained transporter backend

`src/group.cjs` uses source-to-destination permutations. `compose(a,b)[x] = b[a[x]]`: words are chronological move lists. It does not modify the website or puzzle state.

Input: degree `d`, original generators `moves[i].perm`, endpoint-protected positions `F`, distinct endpoints `(a,b)`. Output: an original-generator word `w` whose product fixes every `f in F`, sends `a` to `b`, and sends `b` to `a`. Other positions are unrestricted. Intermediate moves may disturb protected positions.

## Why the algorithm is exact

1. With no protected positions, breadth-first search on the ordered-pair orbit `(a,b)` under the original generators is complete. It visits at most `d(d-1)` pairs, not full puzzle configurations. It yields a shortest original-generator word for that pair request, provided all atomic moves have unit cost. An exhausted orbit that omits `(b,a)` proves impossibility.
2. With one protected position `f`, the algorithm computes its full orbit under the original group. If `r_x(f)=x` and `s(x)=y`, the chronological word `r_x s r_y^-1` fixes `f`. Schreier's lemma says these words generate the complete point stabilizer. Duplicate permutations and identities are removed exactly. The pair search then uses this complete generator set.
3. With two or more protected positions, the base starts with all protected positions, then the requested pair, then remaining positions. A deterministic Schreier–Sims closure maintains strong generators and orbit representatives. Every nonidentity Schreier residue is sifted and added at its first moved base position. Closure is complete only when every Schreier generator sifts to identity. A full list of all positions is a base, so there is no ambiguous residual at the end.
4. Once closure completes, the strong generators that fix the protected base prefix generate its full pointwise stabilizer. The ordered-pair orbit under those generators is therefore the exact set of permitted outcomes for the selected pair.
5. Every stored generator and orbit representative carries a word DAG over original generators. Inverses are DAG sign changes. If an inverse is an explicit atomic move, expansion uses that move; otherwise it repeats the original move `order-1` times, subject to an output budget.
6. Every emitted word is independently composed from original permutations inside `verifyWitness`. Exact integer-index arithmetic checks all protected locations and both requested mappings.

The code only returns `impossible` after contradictory input protections or a completed exact orbit with a complete stabilizer generator set. A deadline, storage cap, generator cap, output cap, or expansion cap returns `unknown`, never impossibility.

## Cost and limitations

- Original moves: O(m d) indices.
- One permutation composition or inverse: O(d).
- A point orbit has at most d entries. A pair orbit has at most d(d-1) entries.
- Orbit tables store full permutations, so a complete chain can have O(d^3) permutation-index storage in the worst case, not just O(d^2) indices. Word DAG storage is additional.
- The one-point Schreier construction has at most d*m raw generators and is fast for the atlas's small piece orbits.
- Multi-point deterministic closure does not enumerate the full group, but it can be costly for large groups and arbitrary protected sets. The implementation uses dynamic deadlines and resource caps.
- Pair BFS in stabilizer generators is shortest in number of those composite generators; it is NOT necessarily shortest in original moves. Only original-generator pair BFS with no protected nodes has the corresponding shortest-move guarantee in this module.
- Raw word expansion can be far longer than the compressed DAG. A legal algebraic transporter may therefore be known when the output cap forces an `unknown` result. The API conservatively does not claim execution success without a delivered verified sequence.
- `estimatedPeakBytes` includes model permutation copies, strong permutations, simultaneous old/new orbit tables, word DAG nodes, and pair-search estimates. It is a conservative internal-data estimate, not an OS RSS measurement or an absolute process cap. The root worker/budget layer supplies additional process controls.

## Regression evidence

An independent exhaustive-state oracle tested 436 queries across nine small permutation groups, including directed generators whose inverses are not supplied. The result compared feasibility, protected locations, both swap mappings, and every reported move. Resource exhaustion cases remained `unknown`.

Early atlas measurements: cube2 arbitrary-small-protected query ~6–14 ms, cube3 ~85–136 ms, FTO ~200–350 ms. A single protected node is handled by direct Schreier and is much cheaper: cube4 ~8 ms, cube6 ~20 ms, cube7 ~37 ms in the same environment. These are pilot observations, not guarantees. Large multi-protected requests can hit a 1.5-second deadline. Some legal composite witnesses have hundreds of moves, reinforcing the need for the root layer's shortest-first search and bounded exact shortening.
