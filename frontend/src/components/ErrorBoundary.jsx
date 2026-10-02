import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f8fafc",
          padding: "1.5rem",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            maxWidth: "32rem",
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
            padding: "2rem",
            textAlign: "center"
          }}>
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1rem auto",
              fontSize: "1.5rem"
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0f172a", marginBottom: "0.5rem" }}>
              Something went wrong
            </h2>

            <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1.25rem", lineHeight: "1.5" }}>
              An unexpected render error occurred in this view. You can reload this view or return to the main dashboard.
            </p>

            {this.state.error && (
              <div style={{
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                borderRadius: "6px",
                padding: "0.75rem",
                fontSize: "0.75rem",
                color: "#475569",
                textAlign: "left",
                fontFamily: "monospace",
                maxHeight: "120px",
                overflowY: "auto",
                marginBottom: "1.25rem",
                wordBreak: "break-word"
              }}>
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={this.handleReset}
                style={{
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: "pointer"
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  window.location.reload();
                }}
                style={{
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "#dc2626",
                  color: "#ffffff",
                  borderRadius: "6px",
                  border: "none",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: "pointer"
                }}
              >
                Reset Flow Storage & Reload
              </button>
              <button
                onClick={() => { window.location.href = "/crm/chatbot"; }}
                style={{
                  padding: "0.5rem 1.25rem",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  cursor: "pointer"
                }}
              >
                Go to Chatbot Studio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
