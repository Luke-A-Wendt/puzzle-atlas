#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const rows=read('benchmarks.json'),env=read('benchmark-environment.json'),manifest=read('data/manifest.json'),validation=read('solution-validation.json');
const labels=['free','one_protected','protected8','exact_swap','known_one_move'];
const counter=records=>({solved:records.filter(r=>r.status==='solved').length,impossible:records.filter(r=>r.status==='impossible').length,unknown:records.filter(r=>r.status==='unknown').length,optimal:records.filter(r=>r.status==='solved'&&r.optimal).length,invalid:records.filter(r=>r.status==='invalid').length});
const total=counter(rows),fmt=r=>!r?'—':r.status==='solved'?`S${r.optimal?'*':''} ${r.moveCount} / ${r.wallMs.toFixed(1)}`:`${r.status==='impossible'?'I':r.status==='unknown'?'U':'INVALID'} / ${r.wallMs.toFixed(1)}`;
const group=new Map();for(const r of rows){const key=r.status+': '+(r.reason||r.stats?.method||'constructive group witness');group.set(key,(group.get(key)||0)+1);}
const peak=env.processResourceUsage?.maxRSS;
const lines=[
'# Backend smoke benchmark',
'',
'These are deterministic selected smoke tests, **not random or representative benchmarks**. Every query begins at the solved labeled simulator state. Results do not establish average responsiveness for arbitrary protected subsets or shortestness of every solution.',
'',
`Run: ${env.startedAt} to ${env.finishedAt}. ${rows.length} queries across ${manifest.models.length} models.`,
'',
`**Outcomes:** ${total.solved} solved; ${total.impossible} proved impossible; ${total.unknown} unknown within the configured limits; ${total.invalid} invalid. Of the solved queries, ${total.optimal} have the search algorithm's shortest-length guarantee.`,
'',
`**Independent engine replay:** ${validation.verified}/${validation.solvedRows} solved witnesses passed (${validation.totalEngineMoveApplications} engine move applications, ${validation.failed} failures). Replay checks legality, endpoint exchange, and protected-node restoration. It does not independently certify shortestness.`,
'',
'## Environment and limits',
'',
`- CPU reported by the runtime: ${env.cpuModel||'unavailable'}; logical processors: ${env.logicalCpuCount||'unavailable'}. ${env.cpuMetadataNote||''} Queries were issued sequentially, each in its own worker; no parallel speedup is claimed.`,
`- Runtime: Node ${env.node}, V8 ${env.v8}; ${env.platform} ${env.architecture}, kernel ${env.osRelease}.`,
`- Host-reported total memory: ${(env.totalSystemMemoryBytes/2**30).toFixed(2)} GiB. This is not a measured container entitlement.`,
`- Solver request limits: ${env.budget.maxMs} ms nominal overall; ${env.budget.searchMs} ms short-search portion; ${env.budget.maxSearchStates} projected search states; depth ${env.budget.maxSearchDepth}; at most ${env.budget.maxOutputMoves} emitted moves. Other guards retain the source defaults recorded in the backend.`,
`- Wall times include worker startup and result transfer. Worker hard-stop grace may make wall times exceed the nominal request limit. Shared-runtime scheduling can affect timings.`,
`- Node process peak RSS, measured with process.resourceUsage().maxRSS on Linux: ${peak===undefined?'unavailable':`${peak.toLocaleString('en-US')} KiB (${(peak/1024).toFixed(1)} MiB)`}. Measurement scope: ${env.resourceMeasurementScope}. This includes workers and benchmark/model loading, not a per-model cache size.`,
...(env.resumedAt?[`- The initial run stopped on an unavailable sandbox memory probe. ${env.rowsBeforeResume} completed query results were retained and only missing scenarios were run in a continuation at ${env.resumedAt}. Whole-suite peak RSS is unavailable. Current-memory probe: ${env.memoryUsageUnavailable||'available'}.`]:[]),
'',
'## Query construction',
'',
'The chosen pair is the first pair of occupied addresses exchanged by one available move if such a pair exists. Otherwise it is a first reachable adjacent pair in the generator action. This deliberately exercises simple witnesses and structural obstructions; it is not a uniform distribution over requests.',
'',
'- **Free:** swap the pair, all other nodes unconstrained.',
'- **One protected:** protect the first occupied non-endpoint address.',
'- **Eight protected:** protect the first eight occupied non-endpoint addresses.',
'- **Exact swap:** protect all other occupied physical addresses.',
'- **Known one move:** when a one-move exchanging pair exists, protect every occupied address fixed by that known move. This is a positive control and deliberately easy.',
'',
'Protected means restored at the end of the entire sequence. The normal Helicopter half-turn subgroup is used; jumbling is excluded. Shape-changing models include potential pose addresses, but only occupied addresses are selected or protected.',
'',
'## Full results',
'',
'Each cell gives `status [move count] / milliseconds`. **S** = solved; **S\*** = solved and shortest by the exact search; **I** = proved impossible under the modeled constraints; **U** = unresolved within resource limits. An em dash means that positive-control scenario was not available. The generator count includes every allowed nonidentity axis rotation, including inverses and half/double turns. Degree is the permutation domain size; it can exceed visible stickers for shape-changing models.',
'',
'| Puzzle | Degree / stickers | Moves | Free | One protected | Eight protected | Exact swap | Known one move |',
'|---|---:|---:|---|---|---|---|---|',
...manifest.models.map(m=>`| ${m.name} | ${m.degree} / ${m.stickerCount} | ${m.moves} | ${labels.map(l=>fmt(rows.find(r=>r.puzzle===m.id&&r.request.label===l))).join(' | ')} |`),
'',
'## Outcome counts by scenario',
'',
'| Scenario | Solved | Impossible | Unknown | Invalid | Shortest solved |',
'|---|---:|---:|---:|---:|---:|',
...labels.map(l=>{const c=counter(rows.filter(r=>r.request.label===l));return`| ${l} | ${c.solved} | ${c.impossible} | ${c.unknown} | ${c.invalid} | ${c.optimal} |`;}),
'',
'## Method and reason counts',
'',
'| Status / method or reason | Count |',
'|---|---:|',
...[...group].sort().map(([k,n])=>`| ${k} | ${n} |`),
'',
'## Interpretation',
'',
'A successful witness is independently checked before returning and again by the saved original engine in this report. Impossible means the exact group/orbit or exhaustively completed projected search established infeasibility; unknown means no such conclusion was obtained in the configured budget. A returned nonoptimal witness is a correct solution, not a shortestness claim.',
'',
'The general backend is usable with bounded resource consumption and explicit unknown results. These tests do not guarantee that every arbitrary request is practical. Worst-case protected-set subgroup construction can remain expensive; increasing budgets is a choice, not a correctness requirement. No full precomputation over all protected subsets is performed.',
'',
'Reproduce with `node tools/benchmark.cjs`, `node tools/verify-solutions.cjs`, then `node tools/summarize-benchmarks.cjs`. Inputs, full move witnesses, environment, and replay results are retained in `benchmarks.json`, `benchmark-environment.json`, and `solution-validation.json`.',
''
];
fs.writeFileSync(path.join(root,'BENCHMARKS.md'),lines.join('\n'));
process.stdout.write(JSON.stringify({...total,queries:rows.length,output:'BENCHMARKS.md'})+'\n');
