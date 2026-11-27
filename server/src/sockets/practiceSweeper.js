/** PRAC-4 / D92: every `everyMs`, expire practice rooms idle for `idleMs` that have no connected socket. */
const { expireIdlePractice } = require('../services/practiceService');
const { logFailure } = require('./flow');

/** Starts the sweep and returns stop(). `everyMs` null or 0 disables it (tests). */
function startPracticeSweeper(io, { everyMs, idleMs }) {
  if (!everyMs) return () => {};
  const isLive = (id) => {
    const runtime = io.runtimes.peek(id);
    return Boolean(runtime && runtime.hasSockets());
  };
  let running = false;
  const timer = setInterval(() => {
    if (running) return; // a slow sweep is never overlapped by the next one
    running = true;
    expireIdlePractice(Date.now(), { idleMs, isLive })
      .catch(logFailure('practice expiry sweep'))
      .finally(() => { running = false; });
  }, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

module.exports = { startPracticeSweeper };
