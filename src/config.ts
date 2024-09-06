function check(
  value: string | undefined,
  name: string
): asserts value is string {
  if (value === undefined)
    throw Error(`Missing \`${name}\` environment variable.`);
}

check(process.env.REDIS_REST_API_TOKEN, "REDIS_REST_API_TOKEN");
check(process.env.REDIS_REST_API_URL, "REDIS_REST_API_URL");
check(process.env.SLACK_CLIENT_ID, "SLACK_CLIENT_ID");
check(process.env.SLACK_CLIENT_SECRET, "SLACK_CLIENT_SECRET");

const config = {
  protocol: process.env.PROTOCOL ?? "https",
  redis: {
    restApiUrl: process.env.REDIS_REST_API_URL,
    restApiToken: process.env.REDIS_REST_API_TOKEN,
  },
  sessionCodeCookieName: "session_code",
  sessionCodeExpiry: 60 * 5, // 5 minutes
  sessionCodeParam: "code",
  slack: {
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    scopes: [
      "channels:read",
      "chat:write.customize",
      "chat:write.public",
      "chat:write",
    ],
  },
} as const;

export default config;
