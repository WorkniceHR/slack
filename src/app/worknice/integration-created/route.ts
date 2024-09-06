import { NextResponse } from "next/server";
import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import redis from "../../../redis";

const fetchWithZod = createZodFetcher();

export const POST = async (request: Request): Promise<NextResponse> => {
  try {
    const data = z
      .object({
        apiToken: z.string(),
        integrationId: z.string(),
      })
      .parse(await request.json());

    await redis.set(`worknice_api_key:${data.integrationId}`, data.apiToken);

    await fetchWithZod(
      z.object({
        data: z.object({
          initializeIntegration: z.object({
            id: z.string(),
          }),
        }),
      }),
      "http://app.worknice.com/api/graphql",
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

    return new NextResponse("ok", {
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 400,
    });
  }
};
