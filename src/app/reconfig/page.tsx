import config from "../../config";
import redis from "../../redis";
import { cookies } from "next/headers";

type PageProps<Params extends string = string, SearchParams extends string = string> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
};

// Define the type for Slack channels
type SlackChannel = {
  id: string;
  name: string;
  is_channel: boolean;
  // You can add more fields based on the Slack API response
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

  return (
    <div>
      <h1>Slack Channels</h1>
      {channels.length > 0 ? (
        <ul>
          {channels.map((channel: SlackChannel) => (
            <li key={channel.id}>{channel.name}</li>
          ))}
        </ul>
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

// Fetches channels from the Slack API using the access token
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
