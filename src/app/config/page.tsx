import session from "@/session";
import slack from "@/slack";
import Link from "next/link";
import redis from "../../redis";
import ConfigForm from "./ConfigForm";

const ReconfigPage = async () => {
  console.log("Retrieving session code…");

  const { integrationId } = await session.getSession();

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

export default ReconfigPage;
