import redis from "../../redis"; // Import Redis

// Ensure this function runs only on the server
export const saveSelectedChannel = async (integrationId: string, selectedChannel: string) => {
  "use server"; // Explicitly tell Next.js this is a server action

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
};
