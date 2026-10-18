import React, { useState } from "react";
import FlowChatDashboard from "../flowchat/pages/Dashboard";
import FormsManager from "../flowchat/pages/FormsManager";
import { Tabs } from "../components/ui";

export default function ChatbotRules() {
  const [activeTab, setActiveTab] = useState("flows"); // "flows" | "forms"

  return (
    <div>
      <Tabs
        tabs={[
          { value: "flows", label: <><i className="bi bi-diagram-3"></i>Bot Flows</> },
          { value: "forms", label: <><i className="bi bi-ui-checks"></i>Forms</> },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "flows" && <FlowChatDashboard />}
      {activeTab === "forms" && <FormsManager />}
    </div>
  );
}
