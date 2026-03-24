"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SkillTreeCanvas] Render error:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
          <div className="text-4xl">🌌</div>
          <p className="font-mono text-sm text-slate-300">Galaxy failed to render</p>
          {this.state.error && (
            <p className="font-mono text-xs text-slate-500 max-w-sm text-center">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="text-xs font-mono px-4 py-1.5 rounded border border-glass-border text-slate-400 hover:text-white hover:border-accent-blue/40 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
