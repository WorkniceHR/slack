import { handleRequestWithWorknice } from "@worknice/js-sdk/helpers";
import crypto from "crypto";
import { z } from "zod";
import config from "../../../config";
import redis from "../../../redis";

export const POST = async (request: Request) =>
  handleRequestWithWorknice<z.infer<typeof requestSchema>, Response>(
    request,
    {
      getApiToken: async () => "",
      getEnv: async () => null,
      handleRequest: async ({ logger, payload }) => {
        logger.debug("Generating authorization code…");

        const sessionCode = crypto.randomBytes(16).toString("hex");

        logger.debug("Saving authorization code…");

        await redis.setIntegrationIdFromSessionCode(
          sessionCode,
          payload.integrationId
        );

        return Response.json(
          {
            reconfigurationUrl: `${config.baseUrl}/reconfig-request?${config.sessionCodeParam}=${sessionCode}`,
          },
          { status: 200 }
        );
      },
      parsePayload: async ({ request }) =>
        requestSchema.parse(await request.json()),
    },
    {
      apiUrl: `${config.worknice.baseUrl}/api/graphql`,
      debug: true,
    }
  );

const requestSchema = z.object({
  integrationId: z.string(),
});
