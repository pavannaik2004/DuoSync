import { useState } from 'react';
import ConfirmButton from '../ConfirmButton';
import ClueView from '../clues/ClueView';
import TimerDisplay from './TimerDisplay';
import LevelBar from './LevelBar';
import AnswerBox from './AnswerBox';
import ResultFlash from './ResultFlash';
import HintPanel from './HintPanel';
import Board from './Board';
import ChatPanel from './ChatPanel';
import { attemptShape, gameActionsShape } from './gameShapes';

const TABS = [
  ['clue', 'Clue'],
  ['board', 'Board'],
  ['chat', 'Chat'],
];

/**
 * The attempt screen: timer, level bar, the player's own clue half with the answer
 * box, the team board and chat. Below 900 px the three panels become tabs, and
 * the Chat tab shows how many messages arrived while it was closed (UI-3).
 */
export default function GameScreen({ state, actions }) {
  const [tab, setTab] = useState('clue');
  const [seenChat, setSeenChat] = useState(state.chat.length);
  const [quitting, setQuitting] = useState(false);
  const { theme, me, clue } = state;
  const myRole = me.role ? theme.roles[me.role] : null;
  const unread = tab === 'chat' ? 0 : Math.max(0, state.chat.length - seenChat);

  function openTab(next) {
    if (tab === 'chat' || next === 'chat') setSeenChat(state.chat.length);
    setTab(next);
  }

  async function quit() {
    setQuitting(true);
    await actions.quit();
    setQuitting(false);
  }

  return (
    <div className="game">
      <header className="game-head">
        <h1>{theme.name}</h1>
        <TimerDisplay remainingMs={state.remainingMs} />
        <ConfirmButton label="End attempt" confirmLabel="End now, keep my points" danger busy={quitting} onConfirm={quit} />
      </header>

      <LevelBar levels={state.levels} score={state.score} />
      <ResultFlash result={state.lastResult} roles={theme.roles} />

      <div className="game-tabs" role="tablist" aria-label="Game panels">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`game-tab${tab === id ? ' is-active' : ''}`}
            onClick={() => openTab(id)}
          >
            {label}
            {id === 'chat' && unread > 0 && <span className="unread" aria-label={`${unread} new`}>{unread}</span>}
          </button>
        ))}
      </div>

      <div className="game-panels" data-tab={tab}>
        <section id="panel-clue" className={`panel panel-clue role-${(me.role || 'a').toLowerCase()}`} aria-labelledby="tab-clue">
          {clue ? (
            <>
              <p className="clue-kicker">
                Level {clue.order}: {clue.title}
                {myRole && <span className="clue-role">Your half as {myRole.name}</span>}
              </p>
              <div className="clue-card">
                <ClueView clue={clue.clue} />
              </div>
              <p className="form-note">Your teammate sees a different half. Describe yours in the chat.</p>
              {clue.hint && <HintPanel key={clue.order} hint={clue.hint} onReveal={() => actions.revealHint(clue.order)} />}
              <AnswerBox key={clue.order} order={clue.order} onSubmit={(answer) => actions.submit(clue.order, answer)} />
            </>
          ) : (
            <p className="form-note">Waiting for the next level…</p>
          )}
        </section>

        <section id="panel-board" className="panel panel-board" aria-labelledby="tab-board">
          <h2>Team board</h2>
          <Board board={state.board} />
        </section>

        <section id="panel-chat" className="panel panel-chat" aria-labelledby="tab-chat">
          <h2>Team chat</h2>
          <ChatPanel messages={state.chat} roles={theme.roles} onSend={actions.sendChat} />
        </section>
      </div>
    </div>
  );
}

GameScreen.propTypes = {
  state: attemptShape.isRequired,
  actions: gameActionsShape.isRequired,
};
