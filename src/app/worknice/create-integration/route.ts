import config from "@/config";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "../../../redis";

const fetchWithZod = createZodFetcher();

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    console.log("Parsing request…");

    const data = z
      .object({
        apiToken: z.string(),
        integrationId: z.string(),
      })
      .parse(await request.json());

    console.log("Saving token…");

    await redis.set(`worknice_api_key:${data.integrationId}`, data.apiToken);

    console.log("Initializing integration…");

    await fetchWithZod(
      z.object({
        data: z.object({
          initializeIntegration: z.object({
            id: z.string(),
          }),
        }),
      }),
      `${config.worknice.baseUrl}/api/graphql`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "worknice-api-token": data.apiToken,
        },
        body: JSON.stringify({
          query: `
            mutation InitializeIntegration($id: ID!) {
              initializeIntegration(integrationId: $id) {
                id
              }
            }
          `,
          variables: { id: data.integrationId },
        }),
      }
    );

    console.log("Done.");

    return new NextResponse("ok", {
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};
