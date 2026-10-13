'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createPage} = require('./solver-dom.cjs');
const games = path.join(__dirname, '../dist/games');
const clean = value => JSON.parse(JSON.stringify(value));

// Real native puzzle/bridge/solver scripts, with controllable network and Worker
// boundaries. These tests exercise the slow-device startup path without relying
// on a browser rendering rate or allowing a timeout to cost real wall time.
function host(id = 'megaminx', {deferModel = false} = {}) {
  const workers = [], fetches = [], pending = [], runCalls = [];
  class DeferredWorker {
    constructor(url) { this.url = String(url); this.listeners = {}; this.terminated = false; workers.push(this); }
    postMessage(request) { this.request = clean(request); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(f => f !== fn); }
    terminate() { this.terminated = true; }
    reply(data, force = false) {
      if (this.terminated && !force) return;
      const event = {data}; this.onmessage?.(event);
      for (const fn of this.listeners.message || []) fn(event);
    }
    progress(stage) { this.reply({id: this.request.id, type: 'progress', stage}); }
    fail(reason, detail) { this.reply({id: this.request.id, type: 'result', result: {status: 'unknown', reason, detail}}); }
  }
  const response = url => {
    const file = path.join(games, new URL(String(url), 'https://atlas.test/games/').pathname.replace(/^\/games\//, ''));
    return {ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, text: async () => fs.readFileSync(file, 'utf8')};
  };
  const app = createPage(id, {skipScripts: ['constrained-solver.js'], globals: {
    Worker: DeferredWorker,
    navigator: {deviceMemory: 0.5, hardwareConcurrency: 1, userAgent: 'Android older-phone regression host', clipboard: {writeText: async () => {}}},
    fetch: url => {
      fetches.push(String(url));
      if (deferModel) return new Promise((resolve, reject) => pending.push({resolve: () => resolve(response(url)), reject}));
      return Promise.resolve(response(url));
    }
  }});
  const original = app.context.PUZZLE_API;
  app.context.PUZZLE_API = Object.freeze({...original, runMoves: moves => {
    runCalls.push(clean(moves)); return original.runMoves(moves);
  }});
  app.document.currentScript = {src: new URL('constrained-solver.js', app.document.baseURI).href};
  app.loadScript('constrained-solver.js'); app.document.currentScript = null;
  Object.assign(app, {workers, fetches, pending, runCalls, original});
  app.ui = () => app.context.ConstrainedSolverUI;
  app.core = () => app.context.ConstrainedSolverCore;
  app.model = JSON.parse(fs.readFileSync(path.join(games, 'constrained-solver-models', id + '.json'), 'utf8'));
  app.waitFor = async (predicate, label = 'asynchronous solver transition') => {
    for (let i = 0; i < 250 && !predicate(); i++) await app.advance(0);
    assert(predicate(), label);
  };
  app.scramble = async () => {
    app.scrambleIndex = app.model.moves.findIndex(move => move.perm.some((to, from) => to !== from));
    assert.equal(original.runMoves([app.model.moves[app.scrambleIndex].engineMove]), true);
    for (let i = 0; i < 20; i++) {
      await app.advance(2000);
      if (!app.snapshot().animating && app.snapshot().mode === 'idle') break;
    }
    assert.equal(app.snapshot().animating, false); assert.equal(app.snapshot().mode, 'idle');
    assert.notEqual(app.snapshot().solved, true);
    runCalls.length = 0;
  };
  app.fullWorker = () => workers.filter(worker => worker.request?.task === 'full-solve').at(-1);
  app.start = async () => {
    app.click('solve'); await app.waitFor(() => !!app.fullWorker(), 'full-solve worker starts after model verification');
    return app.fullWorker();
  };
  app.assertNotice = pattern => {
    assert.equal(app.element('csAutoNotice').hidden, false, 'startup/error notice remains visible at top');
    assert.match(app.element('csAutoNoticeText').textContent, pattern);
  };
  app.solvedReply = worker => {
    const snap = app.snapshot(), progress = app.core().solvedProgress(app.model, snap);
    const before = app.core().mapSnapshot(app.model, snap), home = app.model.homeBySticker;
    const forward = app.model.moves[app.scrambleIndex].perm;
    const inverse = app.model.moves.findIndex(move => move.perm.every((to, from) => forward[to] === from));
    assert(inverse >= 0, 'fixture has an inverse legal move');
    const newlySolvedNodes = progress.remainingStickerIds.map(id => home[id]);
    const targetNode = newlySolvedNodes[0], targetSticker = progress.remainingStickerIds[0];
    const stage = {moveIndices: [inverse], protectedNodes: progress.solvedNodes, newlySolvedNodes, targetNode, sourceNode: before.stickerToNode[targetSticker]};
    const result = {status: 'solved', initialProtectedNodes: progress.solvedNodes, stages: [stage], moveIndices: [inverse], finalProtectedNodes: Object.values(home), optimal: true, verified: true};
    assert.equal(app.core().verifyAutoPlan(app.model, snap, result), true, 'test reply is an independently legal full solution');
    return {id: worker.request.id, type: 'result', result, modelFingerprint: app.core().modelFingerprint(app.model)};
  };
  return app;
}

for (const id of ['megaminx', 'crystal']) {
  test(id + ': Auto Solve visibly starts before a delayed model download, and Stop cancels startup', async () => {
    const app = host(id, {deferModel: true}); await app.scramble();
    const before = app.snapshot().stickers;
    app.click('solve');
    assert.equal(app.ui().state().active, true);
    assert.equal(app.ui().state().phase, 'loading');
    assert.equal(app.element('constrainedSolverToggle').getAttribute('aria-pressed'), 'true');
    assert.match(app.element('status').textContent, /solving/i);
    app.assertNotice(/load|download|prepar/i);
    assert.equal(app.element('csAutoNoticeProgress').hidden, false);
    assert.equal(app.element('csAutoNoticeProgress').hasAttribute('value'), false, 'unknown download duration uses an indeterminate bar');
    assert.equal(app.element('pause').hidden, false); assert.equal(app.element('pause').textContent, 'Stop');
    assert.equal(app.fullWorker(), undefined);
    await app.advance(4000);
    assert.equal(app.ui().state().phase, 'loading', 'a slow phone/network is not mistaken for a failed solve');
    app.click('pause');
    assert.equal(app.ui().state().active, false); assert.equal(app.ui().state().phase, 'off');
    assert.equal(app.element('pause').hidden, true);
    assert.equal(app.element('csAutoNotice').hidden, true);
    for (const fetch of app.pending) fetch.resolve();
    await app.flush(30); await app.advance(0); await app.flush(30);
    assert.equal(app.fullWorker(), undefined, 'late model resolution cannot revive a canceled solve');
    assert.equal(app.runCalls.length, 0); assert.deepEqual(app.snapshot().stickers, before);
  });
}

test('a failed startup download retains a visible reason and Retry restarts the same unsolved state', async () => {
  const app = host('megaminx', {deferModel: true}); await app.scramble();
  const before = app.snapshot().stickers;
  app.click('solve'); await app.waitFor(() => app.pending.length > 0);
  app.pending.shift().reject(new TypeError('Failed to fetch'));
  await app.waitFor(() => !['loading', 'solving'].includes(app.ui().state().phase));
  app.assertNotice(/download|network|connection|fetch/i);
  assert.equal(app.element('csAutoNoticeRetry').hidden, false);
  assert.equal(app.element('csAutoNoticeProgress').hidden, true);
  assert.equal(app.runCalls.length, 0); assert.deepEqual(app.snapshot().stickers, before);
  app.click('csAutoNoticeRetry');
  assert.equal(app.ui().state().phase, 'loading'); assert.match(app.element('status').textContent, /solving/i);
  await app.waitFor(() => app.pending.length > 0);
  app.pending.shift().resolve();
  await app.waitFor(() => !!app.fullWorker());
  assert.equal(app.fullWorker().request.task, 'full-solve');
  assert.deepEqual(app.fullWorker().request.snapshot.stickers, before);
  app.click('pause');
});

test('worker progress gets a fresh per-stage deadline instead of one combined download/planning limit', async () => {
  const app = host('crystal'); await app.scramble(); const worker = await app.start();
  worker.progress('loading-model'); app.assertNotice(/model|move|load/i); await app.advance(19000);
  assert.equal(worker.terminated, false);
  worker.progress('loading-cache'); app.assertNotice(/cache|table|stabilizer|load/i); await app.advance(19000);
  assert.equal(worker.terminated, false, 'two healthy downloads may outlast the former combined 27-second limit');
  assert.equal(app.ui().state().phase, 'solving');
  worker.progress('planning'); app.assertNotice(/plan|find|solution/i);
  worker.progress('verifying'); app.assertNotice(/verif|check/i);
  assert.equal(app.element('pause').hidden, false); assert.match(app.element('status').textContent, /solving/i);
  assert.equal(app.runCalls.length, 0); app.click('pause');
});

test('a stalled or crashed worker leaves a visible diagnostic rather than silently exiting Auto Solve', async () => {
  for (const failure of ['stalled', 'crashed', 'unreadable']) {
    const app = host('crystal'); await app.scramble(); const before = app.snapshot().stickers;
    const worker = await app.start();
    if (failure === 'stalled') { worker.progress('loading-cache'); await app.advance(24001); }
    else if (failure === 'crashed') worker.onerror({message: 'Worker stopped while reserving memory'});
    else worker.onmessageerror({});
    await app.flush();
    app.assertNotice(failure === 'stalled' ? /timed out|timeout/i : /browser|worker/i);
    assert.equal(app.element('csAutoNoticeRetry').hidden, false);
    assert.equal(worker.terminated, true, 'failed worker is released');
    assert.equal(app.element('pause').hidden, true);
    assert.equal(app.runCalls.length, 0); assert.deepEqual(app.snapshot().stickers, before);
  }
});

test('cache, worker, and compute failures report distinguishable diagnostics and execute no moves', async () => {
  const cases = [
    ['cache_network_error', 'The stabilizer cache download failed: connection lost.', /cache|download|connection/i],
    ['worker_unavailable', 'The browser could not start the background worker.', /worker|background|browser/i],
    ['time_limit', 'Planning reached the available time limit.', /time|limit|longer/i]
  ];
  const messages = [];
  for (const [reason, detail, pattern] of cases) {
    const app = host('megaminx'); await app.scramble(); const before = app.snapshot().stickers;
    const worker = await app.start(); worker.fail(reason, detail); await app.flush();
    app.assertNotice(pattern); messages.push(app.element('csAutoNoticeText').textContent);
    assert.equal(app.element('csAutoNoticeRetry').hidden, false);
    assert.equal(app.element('csAutoNoticeProgress').hidden, true);
    assert.equal(app.element('pause').hidden, true);
    assert.equal(app.runCalls.length, 0); assert.deepEqual(app.snapshot().stickers, before);
    app.click('csAutoNoticeRetry'); await app.waitFor(() => app.fullWorker() !== worker);
    assert.equal(app.fullWorker().request.task, 'full-solve');
    worker.reply(app.solvedReply(worker), true); await app.advance(0);
    assert.equal(app.runCalls.length, 0, 'a stale reply from a failed attempt cannot start playback during Retry');
    app.click('pause');
  }
  assert.equal(new Set(messages).size, cases.length, 'diagnostics identify the actual failure, not one generic compute warning');
});

test('restarting manual A/B selection does not constrain a subsequent Auto Solve', async () => {
  const app = host('megaminx'); await app.scramble();
  const activating = app.ui().setActive(true);
  await app.waitFor(() => app.ui().state().phase === 'selecting'); await activating;
  const moved = app.core().solvedProgress(app.model, app.snapshot()).remainingStickerIds;
  assert(moved.length >= 3);
  app.ui().selectNode(moved[0]);
  app.click('csPairA'); assert.equal(app.ui().selectNode(moved[1]), true); assert.equal(app.ui().selectNode(moved[2]), true);
  assert.equal(app.ui().state().pair.length, 2);
  app.click('csPairA'); assert.deepEqual(Array.from(app.ui().state().pair), []);
  assert.deepEqual(Array.from(app.ui().state().held), [moved[0]]);
  const worker = await app.start();
  assert.deepEqual(Array.from(app.ui().state().held), [], 'manual holds must not be carried into full-state solving');
  assert.deepEqual(Array.from(app.ui().state().pair), []);
  assert.equal(worker.request.selection, undefined); assert.deepEqual(worker.request.snapshot.history, []);
  const reply = app.solvedReply(worker); worker.reply(reply);
  for (let i = 0; i < 20 && app.ui().state().active; i++) await app.advance(2000);
  assert.equal(app.runCalls.length, 1, 'verified full solve executes despite the earlier manual pair reset');
  assert.equal(app.core().solvedProgress(app.model, app.snapshot()).solvedCount, app.model.stickerCount);
  assert.equal(app.ui().state().active, false); assert.equal(app.ui().state().phase, 'off');
  assert.deepEqual(Array.from(app.ui().state().held), []); assert.deepEqual(Array.from(app.ui().state().pair), []);
});
