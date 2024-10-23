import { cookies } from "next/headers";
import config from "../../config";
import redis from "../../redis";
import ConfigForm from "./ConfigForm";
import Link from "next/link";

type PageProps<
  Params extends string = string,
  SearchParams extends string = string
> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
};

// Define the type for Slack channels
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

  const integrationId = await redis.getIntegrationIdFromSessionCode(
    sessionCode
  );

  if (integrationId === null) {
    throw Error("Unable to retrieve integration ID.");
  }

  console.log("Retrieving access token…");

  const accessToken = await redis.getSlackAccessToken(integrationId);

  if (accessToken === null) {
    throw Error("Unable to retrieve access token.");
  }

  console.log("Fetching list of Slack channels…");

  const channels: SlackChannel[] = await fetchSlackChannels(accessToken);

  console.log("Fetching saved person activated channel…");

  const savedPersonActivatedChannel =
    await redis.getPersonActivatedSlackChannel(integrationId);

  console.log("Fetching saved calendar update channel…");

  const savedCalendarUpdateChannel = await redis.getCalendarUpdateSlackChannel(
    integrationId
  );

  console.log("Fetching saved new starter channel…");

  const savedNewStarterChannel = await redis.getNewStarterSlackChannel(
    integrationId
  );

  return (
    <div className="Container">
      <br />
      <Link
        href={`https://app.worknice.com/admin/apps/integrations/${integrationId}`}
        passHref
      >
        <button className="back-button">
          <svg className="back-icon"></svg>
          {"Slack Integration"}
        </button>
      </Link>
      {channels.length > 0 ? (
        <ConfigForm
          channels={channels}
          integrationId={integrationId}
          personActivatedChannel={savedPersonActivatedChannel}
          calendarUpdateChannel={savedCalendarUpdateChannel}
          newStarterChannel={savedNewStarterChannel}
        />
      ) : (
        <p>No channels found.</p>
      )}
    </div>
  );
};

const getSessionCode = (
  cookieStore: ReturnType<typeof cookies>,
  searchParams: PageProps["searchParams"]
) => {
  const param = searchParams[config.sessionCodeParam];

  if (typeof param === "string") return param;

  const sessionCodeCookie = cookieStore.get(config.sessionCodeCookieName);

  if (sessionCodeCookie !== undefined) return sessionCodeCookie.value;

  throw Error("Unable to retrieve session code.");
};

// Fetches channels from the Slack API using the access token
const fetchSlackChannels = async (
  accessToken: string
): Promise<SlackChannel[]> => {
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
