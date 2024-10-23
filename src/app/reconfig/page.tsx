import { cookies } from "next/headers";
import config from "../../config";
import redis from "../../redis";
import ConfigForm from "./ConfigForm";
import Link from "next/link";
import slack from "@/slack";

type PageProps<
  Params extends string = string,
  SearchParams extends string = string
> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
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

  const channels = await slack.listChannels(accessToken);

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

export default ReconfigPage;
