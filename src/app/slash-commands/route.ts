import config from "@/config";
import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import { unstable_after as after } from "next/server";
import { parse } from "querystring";
import { z } from "zod";

export const POST = async (request: Request) =>
  handleRequestWithWorknice<
    z.infer<typeof slackRequestSchema>,
    { text: string }
  >(request, {
    getApiToken: async () => "",
    getEnv: async () => null,
    handleRequest: async ({ payload }) => {
      after(async () => {
        await fetch(
          `${config.baseUrl}/slash-commands/${HANDLERS[payload.command]}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      });
      return { text: "Working..." };
    },
    parsePayload: async ({ request }) => {
      const text = await request.text();
      return slackRequestSchema.parse(parse(text));
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
