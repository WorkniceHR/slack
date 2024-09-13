"use client"; // Ensure this is a client-side component

import { useState } from "react";

// Define Slack Channel type
type SlackChannel = {
  id: string;
  name: string;
};

type Props = {
  channels: SlackChannel[];
  onSave: (integrationId: string, selectedChannel: string) => Promise<{ success: boolean; message: string }>;
  integrationId: string;
};

const ConfigForm = ({ channels, integrationId, onSave }: Props) => {
  const [selectedChannel, setSelectedChannel] = useState("");
  const [status, setStatus] = useState<string>("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedChannel) {
      alert("Please select a channel.");
      return;
    }

    try {
      // Call the server-side onSave function passed as a prop
      const result = await onSave(integrationId, selectedChannel);

      setStatus(result.message || "Channel saved successfully!");
    } catch (error) {
      console.error("Failed to save channel:", error);
      setStatus("Failed to save channel.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="channel">New Person Activated</label>
      <select
        id="channel"
        name="channel"
        value={selectedChannel}
        onChange={(e) => setSelectedChannel(e.target.value)}
      >
        <option value="">Select a channel</option>
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>
      <button type="submit">Save</button>
      {status && <p>{status}</p>}
    </form>
  );
};

export default ConfigForm;
