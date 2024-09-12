import { Redis } from "@upstash/redis";
import config from "./config";

const client = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken,
});

const redis = {
  setIntegrationId: (sessionCode: string, value: string) =>
    client.set(`session_code_integration_id:${sessionCode}`, value, {
      ex: config.sessionCodeExpiry,
    }),

export default redis;
