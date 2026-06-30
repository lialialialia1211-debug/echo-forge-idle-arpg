import React, { type ReactNode } from "react";

type ErrorBoundaryState = {
  message: string | null;
};

export class ErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : "The game client stopped unexpectedly." };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="app-error-shell">
          <section>
            <strong>Game client stopped</strong>
            <p>{this.state.message}</p>
            <button onClick={() => window.location.reload()} type="button">
              Reload game
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
