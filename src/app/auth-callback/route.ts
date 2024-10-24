import slack from "@/slack";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import config from "../../config";
import redis from "../../redis";

const fetchWithZod = createZodFetcher();

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    console.log("Retrieving session code…");

    const cookieStore = await cookies();

    const sessionCodeCookie = cookieStore.get(config.sessionCodeCookieName);

    if (sessionCodeCookie === undefined) {
      throw Error("Unable to retrieve session code.");
    }

    console.log("Retrieving callback code…");

    const code = request.nextUrl.searchParams.get("code");

    if (code === null) {
      throw Error("Missing callback code.");
    }

    console.log("Exchanging callback code for access token…");

    const response = await slack.getAccessToken(code);

    console.log("Retrieving integration ID…");

    const integrationId = await redis.getIntegrationIdFromSessionCode(
      sessionCodeCookie.value
    );

    if (integrationId === null) {
      throw Error("Authorization request not found");
    }

    console.log("Saving access token…");

    await redis.setSlackAccessToken(integrationId, response.access_token);

    if (response.bot_user_id) {
      await redis.setSlackBotUserId(integrationId, response.bot_user_id);
    }

    if (response.team?.id) {
      await redis.setIntegrationIdFromSlackTeamId(
        response.team.id,
        integrationId
      );
    }

    if (response.enterprise?.id) {
      await redis.setSlackEnterpriseId(integrationId, response.enterprise.id);
    }

    console.log("Retrieving API token…");

    const apiToken = await redis.getWorkniceApiKey(integrationId);

    if (apiToken === null) {
      throw Error("Unable to retrieving API key.");
    }

    console.log("Activating integration…");

    await fetchWithZod(
      z.object({
        data: z.object({
          updateIntegration: z.object({
            id: z.string(),
          }),
          activateIntegration: z.object({
            id: z.string(),
          }),
        }),
      }),
      `${config.worknice.baseUrl}/api/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "worknice-api-token": apiToken,
        },
        body: JSON.stringify({
          query: `
            mutation ActivateIntegration($id: ID!, $name: String!) {
              updateIntegration(integrationId: $id, name: $name) {
                id
              }
              activateIntegration(integrationId: $id) {
                id
              }
            }
          `,
          variables: { id: integrationId, name: response.team.name },
        }),
      }
    );

    console.log("Done.");

    return NextResponse.redirect(
      `${config.worknice.baseUrl}/admin/apps/integrations/${integrationId}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};
