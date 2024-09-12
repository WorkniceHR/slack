import { Redis } from "@upstash/redis";
import config from "./config";

const client = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken,
});

const redis = {
  getIntegrationId: (sessionCode: string) =>
    client.get<string>(`session_code_integration_id:${sessionCode}`),
};

export default redis;
