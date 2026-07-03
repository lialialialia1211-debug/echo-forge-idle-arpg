import React, { type ReactNode } from "react";
import { t } from "../game/locale/zh-Hant";

type ErrorBoundaryState = {
  message: string | null;
};

export class ErrorBoundary extends React.Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { message: error instanceof Error ? error.message : t("app.error.title") };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.message) {
      return (
        <main className="app-error-shell">
          <section>
            <strong>{t("app.error.title")}</strong>
            <p>{this.state.message}</p>
            <button onClick={() => window.location.reload()} type="button">
              {t("app.error.reload")}
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
