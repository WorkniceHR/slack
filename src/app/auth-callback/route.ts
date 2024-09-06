import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import config from "../../config";
import redis from "../../redis";
import { createZodFetcher } from "zod-fetch";
import { z } from "zod";

const fetchWithZod = createZodFetcher();

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  try {
    console.log("Retrieving session code…");

    const cookieStore = cookies();

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

    const response = await fetchWithZod(
      z
        .object({
          access_token: z.string(),
          ok: z.literal(true),
          bot_user_id: z.string(),
          team: z.object({
            name: z.string(),
            id: z.string(),
          }),
          enterprise: z
            .object({
              id: z.string(),
            })
            .nullable(),
        })
        .passthrough(),
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: config.slack.clientId,
          client_secret: config.slack.clientSecret,
          code,
        }),
      }
    );

    console.log("Retrieving integration ID…");

    const integrationId = await redis.get<string>(
      `session_code_integration_id:${sessionCodeCookie.value}`
    );

    if (integrationId === null) {
      throw Error("Authorization request not found");
    }

    console.log("Saving access token…");

    await redis.set(
      `slack_access_token:${integrationId}`,
      response.access_token
    );

    if (response.bot_user_id) {
      await redis.set(
        `slack_bot_user_id:${integrationId}`,
        response.bot_user_id
      );
    }

    if (response.team_id) {
      await redis.set(`slack_team_id:${integrationId}`, response.team_id);
    }

    if (response.enterprise_id) {
      await redis.set(
        `slack_enterprise_id:${integrationId}`,
        response.enterprise_id
      );
    }

    console.log("Retrieving API token…");

    const apiToken = await redis.get<string>(
      `worknice_api_key:${integrationId}`
    );

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
      "http://app.worknice.com/api/graphql",
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
      `https://app.wornice.com/admin/integrations/${integrationId}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};
