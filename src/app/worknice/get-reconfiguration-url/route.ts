import config from "@/config";
import redis from "@/redis";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const data = requestSchema.parse(await request.json());

    const authorizationCode = crypto.randomBytes(16).toString("hex");

    await redis.setIntegrationId(authorizationCode, data.integrationId);

    return NextResponse.json(
      {
        reconfigurationUrl: `https://slack.worknice.com/reconfig?${
          config.sessionCodeParam
        }=${authorizationCode}`,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};

const requestSchema = z.object({
  integrationId: z.string(),
});
