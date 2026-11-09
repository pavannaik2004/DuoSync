import { Component } from 'react';
import PropTypes from 'prop-types';

/**
 * Catches render errors so the page never goes blank (NFR-20). A class component
 * because React error boundaries can only be written as classes (§10.1 Unit II).
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error('Unexpected error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="page narrow" role="alert">
        <h1>Something went wrong</h1>
        <p>This page hit an unexpected error. Going back to the start usually fixes it.</p>
        <p><a className="btn btn-primary" href="/dashboard">Go to the dashboard</a></p>
      </section>
    );
  }
}

ErrorBoundary.propTypes = { children: PropTypes.node.isRequired };
