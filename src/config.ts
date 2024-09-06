function check(
  value: string | undefined,
  name: string
): asserts value is string {
  if (value === undefined)
    throw Error(`Missing \`${name}\` environment variable.`);
}

check(process.env.REDIS_REST_API_TOKEN, "REDIS_REST_API_TOKEN");
check(process.env.REDIS_REST_API_URL, "REDIS_REST_API_URL");

const config = {
  redis: {
    restApiUrl: process.env.REDIS_REST_API_URL,
    restApiToken: process.env.REDIS_REST_API_TOKEN,
  },
} as const;

export default config;
