function check(
  value: string | undefined,
  name: string
): asserts value is string {
  if (value === undefined)
    throw Error(`Missing \`${name}\` environment variable.`);
}

check(process.env.BASE_URL, "BASE_URL");
check(process.env.CRON_SECRET, "CRON_SECRET");
check(process.env.REDIS_REST_API_TOKEN, "REDIS_REST_API_TOKEN");
check(process.env.REDIS_REST_API_URL, "REDIS_REST_API_URL");
check(process.env.SLACK_CLIENT_ID, "SLACK_CLIENT_ID");
check(process.env.SLACK_CLIENT_SECRET, "SLACK_CLIENT_SECRET");
check(process.env.SLACK_SIGNING_SECRET, "SLACK_SIGNING_SECRET");

const config = {
  baseUrl: process.env.BASE_URL,
  redis: {
    restApiUrl: process.env.REDIS_REST_API_URL,
    restApiToken: process.env.REDIS_REST_API_TOKEN,
  },
  sessionCodeExpiry: 60 * 5, // 5 minutes
  sessionCodeParam: "code",
  sessionTokenCookieName: "session_token",
  sessionTokenExpiry: 60 * 60 * 1, // 1 hour
  slack: {
    clientId: process.env.SLACK_CLIENT_ID,
    clientSecret: process.env.SLACK_CLIENT_SECRET,
    redirectUri:
      process.env.SLACK_REDIRECT_URI ??
      "https://slack.worknice.com/auth-callback",
    scopes: [
      "channels:read",
      "chat:write.customize",
      "chat:write.public",
      "chat:write",
      "users:read",
      "users:read.email",
    ],
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
  vercel: {
    cronSecret: process.env.CRON_SECRET,
  },
  worknice: {
    baseUrl: process.env.WORKNICE_BASE_URL ?? "https://app.worknice.com",
  },
} as const;

export default config;
