import { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * The attempt timer, as a class component (§10.1 Unit II). It only displays the
 * server's remaining time (TIME-1); it never counts down on its own.
 */
export default class TimerDisplay extends Component {
  static format(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = String(total % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  render() {
    const { remainingMs, paused } = this.props;
    const low = remainingMs !== null && remainingMs <= 60000;
    const text = remainingMs === null ? '--:--' : TimerDisplay.format(remainingMs);
    const label = paused ? 'Paused' : 'Time left';
    return (
      <div className={`timer${low ? ' timer-low' : ''}${paused ? ' timer-paused' : ''}`} role="timer" aria-live="off" aria-label={`${label} ${text}`}>
        <span className="timer-label">{label}</span>
        <span className="timer-value">{text}</span>
      </div>
    );
  }
}

TimerDisplay.propTypes = { remainingMs: PropTypes.number, paused: PropTypes.bool };
TimerDisplay.defaultProps = { remainingMs: null, paused: false };
