import { Redis, type SetCommandOptions } from "@upstash/redis";
import config from "./config";

type Key =
  | `session_code:${string}:worknice_integration_id`
  | `session_token:${string}:worknice_integration_id`
  | `slack_team:${string}:worknice_integration_id`
  | `worknice_integration${string}:slack_access_token`
  | `worknice_integration${string}:slack_calendar_update_channel`
  | `worknice_integration${string}:slack_new_starter_channel`
  | `worknice_integration${string}:slack_person_activated_channel`
  | `worknice_integration${string}:slack_team_id`
  | `worknice_integration${string}:worknice_api_key`;

const client = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken,
});

const getAndDeleteString = async (key: Key) => client.getdel<string>(key);

const getString = async (key: Key) => client.get<string>(key);

const setString = async (key: Key, value: string, opts?: SetCommandOptions) =>
  client.set<string>(key, value, opts);

const getAllIntegrationIds = async () => {
  const keys = await client.keys("worknice_integration:*:worknice_api_key");
  return keys
    .map((key) => key.split(":")[1])
    .filter((id): id is string => id !== undefined);
};

const getAndDeleteIntegrationIdFromSessionCode = async (sessionCode: string) =>
  getAndDeleteString(`session_code:${sessionCode}:worknice_integration_id`);

const getCalendarUpdateSlackChannel = async (integrationId: string) =>
  getString(
    `worknice_integration:${integrationId}:slack_calendar_update_channel`
  );

const getIntegrationIdFromSessionToken = async (sessionToken: string) =>
  getString(`session_token:${sessionToken}:worknice_integration_id`);

const getIntegrationIdFromTeamId = async (teamId: string) =>
  getString(`slack_team:${teamId}:worknice_integration_id`);

const getNewStarterSlackChannel = async (integrationId: string) =>
  getString(`worknice_integration:${integrationId}:slack_new_starter_channel`);

const getPersonActivatedSlackChannel = async (integrationId: string) =>
  getString(
    `worknice_integration:${integrationId}:slack_person_activated_channel`
  );

const getSlackAccessToken = async (integrationId: string) =>
  getString(`worknice_integration:${integrationId}:slack_access_token`);

const getSlackTeamIdFromIntegrationId = async (integrationId: string) =>
  getString(`worknice_integration:${integrationId}:slack_team_id`);

const getWorkniceApiKey = async (integrationId: string) =>
  getString(`worknice_integration:${integrationId}:worknice_api_key`);

const purgeIntegration = async (integrationId: string) => {
  const teamId = await client.get(
    `worknice_integration:${integrationId}:slack_team_id`
  );

  await client.del(`slack_team:${teamId}:worknice_integration_id`);
  await client.del(`worknice_integration:${integrationId}:slack_access_token`);
  await client.del(
    `worknice_integration:${integrationId}:slack_calendar_update_channel`
  );
  await client.del(
    `worknice_integration:${integrationId}:slack_new_starter_channel`
  );
  await client.del(
    `worknice_integration:${integrationId}:slack_person_activated_channel`
  );
  await client.del(`worknice_integration:${integrationId}:slack_team_id`);
  await client.del(`worknice_integration:${integrationId}:worknice_api_key`);
};

const setCalendarUpdateSlackChannel = async (
  integrationId: string,
  channel: string
) =>
  setString(
    `worknice_integration:${integrationId}:slack_calendar_update_channel`,
    channel
  );

const setIntegrationIdFromSessionCode = async (
  sessionCode: string,
  integrationId: string
) =>
  setString(
    `session_code:${sessionCode}:worknice_integration_id`,
    integrationId,
    {
      ex: config.sessionCodeExpiry,
    }
  );

const setIntegrationIdFromSessionToken = async (
  sessionToken: string,
  integrationId: string
) =>
  setString(
    `session_token:${sessionToken}:worknice_integration_id`,
    integrationId,
    {
      ex: config.sessionTokenExpiry,
    }
  );

const setIntegrationIdFromSlackTeamId = async (
  teamId: string,
  integrationId: string
) => setString(`slack_team:${teamId}:worknice_integration_id`, integrationId);

const setNewStarterSlackChannel = async (
  integrationId: string,
  channel: string
) =>
  setString(
    `worknice_integration:${integrationId}:slack_new_starter_channel`,
    channel
  );

const setPersonActivatedSlackChannel = async (
  integrationId: string,
  channel: string
) =>
  setString(
    `worknice_integration:${integrationId}:slack_person_activated_channel`,
    channel
  );

const setSlackAccessToken = async (
  integrationId: string,
  accessToken: string
) =>
  setString(
    `worknice_integration:${integrationId}:slack_access_token`,
    accessToken
  );

const setSlackTeamIdFromIntegrationId = async (
  integrationId: string,
  teamId: string
) => setString(`worknice_integration:${integrationId}:slack_team_id`, teamId);

const setWorkniceApiKey = async (integrationId: string, apiKey: string) =>
  setString(`worknice_integration:${integrationId}:worknice_api_key`, apiKey);

const redis = {
  getAllIntegrationIds,
  getAndDeleteIntegrationIdFromSessionCode,
  getCalendarUpdateSlackChannel,
  getIntegrationIdFromSessionToken,
  getIntegrationIdFromTeamId,
  getNewStarterSlackChannel,
  getPersonActivatedSlackChannel,
  getSlackAccessToken,
  getSlackTeamIdFromIntegrationId,
  getWorkniceApiKey,
  purgeIntegration,
  setCalendarUpdateSlackChannel,
  setIntegrationIdFromSessionCode,
  setIntegrationIdFromSessionToken,
  setIntegrationIdFromSlackTeamId,
  setNewStarterSlackChannel,
  setPersonActivatedSlackChannel,
  setSlackAccessToken,
  setSlackTeamIdFromIntegrationId,
  setWorkniceApiKey,
};

export default redis;
