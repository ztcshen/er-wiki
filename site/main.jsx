import React from "react";
import { createRoot } from "react-dom/client";
import Demo from "./Demo";
import "./site.css";

class DemoBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="demo-failure">
        <h1>ER Wiki</h1>
        <p>
          The demo could not be displayed. Please reload, or explore the
          screenshots and desktop app.
        </p>
        <a href="https://github.com/ztcshen/er-wiki">GitHub →</a>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <DemoBoundary>
    <Demo />
  </DemoBoundary>,
);
