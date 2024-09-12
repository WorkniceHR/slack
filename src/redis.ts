import { Redis } from "@upstash/redis";
import config from "./config";

const redis = new Redis({
  url: config.redis.restApiUrl,
  token: config.redis.restApiToken,
});

export default redis;
