import redis from "../../redis"; // Your existing Redis configuration

// Server action to save the selected Slack channel
export async function saveSelectedChannel(integrationId: string, selectedChannel: string) {
  if (!integrationId || !selectedChannel) {
    throw new Error("Missing integrationId or selectedChannel");
  }

  try {
    await redis.set(`slack_channel:person_activated:${integrationId}`, selectedChannel);
    return { success: true, message: "Channel saved successfully" };
  } catch (error) {
    console.error("Error saving channel to Redis:", error);
    return { success: false, error: "Failed to save channel" };
  }
}
