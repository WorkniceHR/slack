import config from "@/config";
import slack from "@/slack";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { unstable_after as after } from "next/server";
import queryString from "querystring";
import { z } from "zod";

type Payload = {
  original: string;
  parsed: z.infer<typeof slackRequestSchema>;
};

export const POST = async (request: Request) =>
  handleRequestWithWorknice<Payload, { text: string }>(request, {
    getApiToken: async () => "",
    getEnv: async () => null,
    handleRequest: async ({ request, payload }) => {
      after(async () => {
        await fetch(
          `${config.baseUrl}/slash-commands/${
            HANDLERS[payload.parsed.command]
          }`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "X-Slack-Signature":
                request.headers.get("X-Slack-Signature") ?? "",
              "X-Slack-Request-Timestamp":
                request.headers.get("X-Slack-Request-Timestamp") ?? "",
            },
            body: payload.original,
          }
        );
      });
      return {
        response_type: "in_channel",
        text: "Working...",
      };
    },
    parsePayload: async ({ request }) => {
      const text = await request.text();

      const signature = request.headers.get("X-Slack-Signature");

      if (signature === null) {
        throw Error("Missing signature header.");
      }

      const timestamp = request.headers.get("X-Slack-Request-Timestamp");

      if (timestamp === null) {
        throw Error("Missing timestamp header.");
      }

      slack.verifyRequest(timestamp, signature, text);

      return {
        original: text,
        parsed: slackRequestSchema.parse(queryString.parse(text)),
      };
    },
  });

const HANDLERS: Record<z.infer<typeof slackRequestSchema>["command"], string> =
  {
    "/whois": "whois",
    "/whosaway": "whosaway",
  } as const;

const slackRequestSchema = z.object({
  command: z.union([z.literal("/whois"), z.literal("/whosaway")]),
  response_url: z.string(),
  team_id: z.string(),
  text: z.string(),
  user_id: z.string(),
});
