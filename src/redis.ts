import { Redis } from "@upstash/redis";
import config from "./config";

const client = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken,
});

const getAllIntegrationIds = async () => {
  const keys = await client.keys("worknice_api_key:*");
  return keys
    .map((key) => key.split(":")[1])
    .filter((id): id is string => id !== undefined);
};

const getCalendarUpdateSlackChannel = async (integrationId: string) =>
  client.get<string>(`slack_channel:calendar_update:${integrationId}`);

const getIntegrationIdFromSessionCode = async (sessionCode: string) =>
  client.get<string>(`session_code_integration_id:${sessionCode}`);

const getIntegrationIdFromTeamId = async (teamId: string) =>
  client.get<string>(`slack_team_id_integration_id:${teamId}`);

const getNewStarterSlackChannel = async (integrationId: string) =>
  client.get<string>(`slack_channel:new_starter:${integrationId}`);

const getPersonActivatedSlackChannel = async (integrationId: string) =>
  client.get<string>(`slack_channel:person_activated:${integrationId}`);

const getSlackAccessToken = async (integrationId: string) =>
  client.get<string>(`slack_access_token:${integrationId}`);

const getWorkniceApiKey = async (integrationId: string) =>
  client.get<string>(`worknice_api_key:${integrationId}`);

const purgeIntegration = async (integrationId: string) => {
  await client.del(`slack_channel:calendar_update:${integrationId}`);
  await client.del(`slack_access_token:${integrationId}`);
  await client.del(`worknice_api_key:${integrationId}`);
  await client.del(`slack_team_id:${integrationId}`);
};

const setCalendarUpdateSlackChannel = async (
  integrationId: string,
  channel: string
) =>
  client.set<string>(`slack_channel:calendar_update:${integrationId}`, channel);

const setIntegrationIdFromSessionCode = async (
  sessionCode: string,
  integrationId: string
) =>
  client.set<string>(
    `session_code_integration_id:${sessionCode}`,
    integrationId,
    {
      ex: config.sessionCodeExpiry,
    }
  );

const setIntegrationIdFromSlackTeamId = async (
  teamId: string,
  integrationId: string
) =>
  client.set<string>(`slack_team_id_integration_id:${teamId}`, integrationId);

const setNewStarterSlackChannel = async (
  integrationId: string,
  channel: string
) => client.set<string>(`slack_channel:new_starter:${integrationId}`, channel);

const setPersonActivatedSlackChannel = async (
  integrationId: string,
  channel: string
) =>
  client.set<string>(
    `slack_channel:person_activated:${integrationId}`,
    channel
  );

const setSlackAccessToken = async (
  integrationId: string,
  accessToken: string
) => client.set<string>(`slack_access_token:${integrationId}`, accessToken);

const setSlackBotUserId = async (integrationId: string, botUserId: string) =>
  client.set<string>(`slack_bot_user_id:${integrationId}`, botUserId);

const setSlackEnterpriseId = async (
  integrationId: string,
  enterpriseId: string
) => client.set<string>(`slack_enterprise_id:${integrationId}`, enterpriseId);

const setWorkniceApiKey = async (integrationId: string, apiKey: string) =>
  client.set<string>(`worknice_api_key:${integrationId}`, apiKey);

const redis = {
  getAllIntegrationIds,
  getCalendarUpdateSlackChannel,
  getIntegrationIdFromSessionCode,
  getIntegrationIdFromTeamId,
  getNewStarterSlackChannel,
  getPersonActivatedSlackChannel,
  getSlackAccessToken,
  getWorkniceApiKey,
  purgeIntegration,
  setCalendarUpdateSlackChannel,
  setIntegrationIdFromSessionCode,
  setIntegrationIdFromSlackTeamId,
  setNewStarterSlackChannel,
  setPersonActivatedSlackChannel,
  setSlackAccessToken,
  setSlackBotUserId,
  setSlackEnterpriseId,
  setWorkniceApiKey,
};

export default redis;
