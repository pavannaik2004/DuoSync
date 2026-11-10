/**
 * One AttemptRuntime per live attempt, kept in memory (roadmap; DECISIONS D15, D37).
 * It holds what does not belong in the database: which sockets are connected, the
 * countdown and tick timers, and a promise queue that runs every mutating event for
 * the attempt one at a time (GAME-7, NFR-9). The timers are closures over the runtime
 * (§10.1 Unit I).
 */
const roomOf = (attemptId) => `attempt:${attemptId}`;

class AttemptRuntime {
  constructor(attemptId, { io, options, drop }) {
    this.attemptId = String(attemptId);
    this.io = io;
    this.options = options;
    this.drop = drop || (() => {});
    this.queue = Promise.resolve();
    this.sockets = new Map(); // playerId → Set<socket>
    this.timers = new Set();
    this.lastSubmitAt = new Map(); // playerId → ms, for the 2-second submit gap (§7.4)
    this.resumed = false; // set once the first join has rebuilt timers from the database (D37)
  }

  /** Runs `fn` after every job queued before it. A failing job does not block the next. */
  enqueue(fn) {
    const run = this.queue.then(() => fn());
    this.queue = run.catch(() => {});
    return run;
  }

  /** Returns true when this is the player's first connected socket. */
  addSocket(playerId, socket) {
    const set = this.sockets.get(playerId) || new Set();
    const first = set.size === 0;
    set.add(socket);
    this.sockets.set(playerId, set);
    return first;
  }

  /** Returns true when the player now has no connected sockets. */
  removeSocket(playerId, socket) {
    const set = this.sockets.get(playerId);
    if (!set) return false;
    set.delete(socket);
    if (set.size > 0) return false;
    this.sockets.delete(playerId);
    return true;
  }

  connectedIds() {
    return [...this.sockets.keys()];
  }

  hasSockets() {
    return this.sockets.size > 0;
  }

  /** Removes this runtime from its registry when nobody is connected (an idle, finished attempt). */
  release() {
    if (!this.hasSockets()) this.drop(this.attemptId);
  }

  emitToRoom(event, payload) {
    this.io.to(roomOf(this.attemptId)).emit(event, payload);
  }

  emitToPlayer(playerId, event, payload) {
    (this.sockets.get(playerId) || []).forEach((socket) => socket.emit(event, payload));
  }

  /** setTimeout / setInterval that stop() clears. */
  later(fn, ms) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }

  every(fn, ms) {
    const timer = setInterval(fn, ms);
    this.timers.add(timer);
    return timer;
  }

  clear(timer) {
    if (!timer) return;
    clearTimeout(timer);
    clearInterval(timer);
    this.timers.delete(timer);
  }

  stop() {
    this.timers.forEach((timer) => {
      clearTimeout(timer);
      clearInterval(timer);
    });
    this.timers.clear();
  }
}

/** The runtimes of one Socket.io server. Created lazily, one per attempt. */
function createRuntimeRegistry(io, options) {
  const runtimes = new Map();
  const registry = {
    size() {
      return runtimes.size;
    },
    get(attemptId) {
      const id = String(attemptId);
      if (!runtimes.has(id)) runtimes.set(id, new AttemptRuntime(id, { io, options, drop: (key) => registry.drop(key) }));
      return runtimes.get(id);
    },
    drop(attemptId) {
      const runtime = runtimes.get(String(attemptId));
      if (runtime) runtime.stop();
      runtimes.delete(String(attemptId));
    },
    stopAll() {
      runtimes.forEach((runtime) => runtime.stop());
      runtimes.clear();
    },
  };
  return registry;
}

module.exports = { AttemptRuntime, createRuntimeRegistry, roomOf };
