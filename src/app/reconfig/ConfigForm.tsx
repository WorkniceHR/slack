"use client";

import { useState } from "react";
import redis from "../../redis"; // Assuming this is the correct path

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedChannel) {
      alert("Please select a channel.");
      return;
    }

    console.log(`Saving selected channel to Redis: ${selectedChannel}`);

    try {
      // Save the selected channel to Redis with the desired key format
      await redis.set(`slack_channel:person_activated:${integrationId}`, selectedChannel);

      console.log("Channel saved successfully.");
      alert("Channel saved successfully!");
    } catch (error) {
      console.error("Failed to save channel to Redis.", error);
      alert("Failed to save channel.");
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
    </form>
  );
};

export default ConfigForm;
