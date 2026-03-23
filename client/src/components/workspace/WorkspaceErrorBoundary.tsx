import React from "react";

interface WorkspaceErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface WorkspaceErrorBoundaryProps {
  children: React.ReactNode;
}

export class WorkspaceErrorBoundary extends React.Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  constructor(props: WorkspaceErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): WorkspaceErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[WorkspaceErrorBoundary] Uncaught error:", error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "2rem",
            backgroundColor: "#0d1117",
          }}
        >
          <div
            style={{
              backgroundColor: "#0d1117",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "0.75rem",
              padding: "2.5rem 2rem",
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "rgba(239,68,68,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(239,68,68,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h2
              style={{
                margin: "0 0 0.5rem",
                fontSize: "1.125rem",
                fontWeight: 600,
                color: "rgba(255,255,255,0.9)",
              }}
            >
              Algo deu errado
            </h2>

            <p
              style={{
                margin: "0 0 1.5rem",
                fontSize: "0.875rem",
                color: "rgba(255,255,255,0.5)",
                lineHeight: 1.6,
              }}
            >
              Ocorreu um erro inesperado ao carregar o Workspace.
            </p>

            {this.state.error?.message && (
              <pre
                style={{
                  margin: "0 0 1.5rem",
                  padding: "0.75rem 1rem",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.35)",
                  textAlign: "left",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {this.state.error.message}
              </pre>
            )}

            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "0.375rem",
                color: "rgba(255,255,255,0.8)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                transition: "background-color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(255,255,255,0.13)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(255,255,255,0.08)";
              }}
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
