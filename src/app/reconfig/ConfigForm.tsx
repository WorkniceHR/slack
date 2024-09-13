"use client";

import { useState } from "react";
import { saveSelectedChannel } from "./actions"; // Import the action

type SlackChannel = {
  id: string;
  name: string;
};

type Props = {
  channels: SlackChannel[];
  integrationId: string;
};

const ConfigForm = ({ channels, integrationId }: Props) => {
  const [selectedChannel, setSelectedChannel] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedChannel) {
      alert("Please select a channel.");
      return;
    }

    try {
      // Call the saveSelectedChannel action on form submission
      const result = await saveSelectedChannel(integrationId, selectedChannel);

      if (result.success) {
        setStatus(result.message);
      } else {
        setStatus(result.error);
      }
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
