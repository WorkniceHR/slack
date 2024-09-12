import config from "../../config";
import redis from "../../redis";
import { cookies } from "next/headers";
import { useState } from "react";

type PageProps<Params extends string = string, SearchParams extends string = string> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
};

type SlackChannel = {
  id: string;
  name: string;
  is_channel: boolean;
};

const ReconfigPage = async ({ searchParams }: PageProps) => {
  const cookieStore = cookies();

  console.log("Retrieving session code…");

  const sessionCode = getSessionCode(cookieStore, searchParams);

  console.log("Retrieving integration ID…");

  const integrationId = await redis.get<string>(`session_code_integration_id:${sessionCode}`);

  if (integrationId === null) {
    throw Error("Unable to retrieve integration ID.");
  }

  console.log("Retrieving access token…");

  const accessToken = await redis.get<string>(`slack_access_token:${integrationId}`);

  if (accessToken === null) {
    throw Error("Unable to retrieve access token.");
  }

  console.log("Fetching list of Slack channels…");

  const channels: SlackChannel[] = await fetchSlackChannels(accessToken);

  // Handle the form submission
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedChannel = event.currentTarget.elements.namedItem("channel") as HTMLSelectElement;
    const selectedChannelId = selectedChannel.value;

    if (!selectedChannelId) {
      throw Error("No channel selected.");
    }

    console.log(`Saving selected channel to Redis: ${selectedChannelId}`);

    // Save the selected channel to Redis with the desired key
    await redis.set(
      `slack_channel:person_activated:${integrationId}`,
      selectedChannelId
    );

    console.log("Channel saved successfully.");
  };

  return (
    <div>
      <h1>Slack Alerts</h1>
      {channels.length > 0 ? (
        <form onSubmit={handleSubmit}>
          <label htmlFor="channel">New Person Activated</label>
          <select id="channel" name="channel">
            {channels.map((channel: SlackChannel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          <button type="submit">Save</button>
        </form>
      ) : (
        <p>No channels found.</p>
      )}
    </div>
  );
};

const getSessionCode = (
  cookieStore: ReturnType<typeof cookies>,
  searchParams: PageProps["searchParams"],
) => {
  const param = searchParams[config.sessionCodeParam];

  if (typeof param === "string") return param;

  const sessionCodeCookie = cookieStore.get(config.sessionCodeCookieName);

  if (sessionCodeCookie !== undefined) return sessionCodeCookie.value;

  throw Error("Unable to retrieve session code.");
};

const fetchSlackChannels = async (accessToken: string): Promise<SlackChannel[]> => {
  const response = await fetch("https://slack.com/api/conversations.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!data.ok) {
    throw new Error("Failed to fetch Slack channels.");
  }

  return data.channels || [];
};

export default ReconfigPage;
