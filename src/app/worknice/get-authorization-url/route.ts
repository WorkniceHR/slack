import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import config from "../../../config";
import redis from "../../../redis";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    console.log("Parsing request…");

    const data = z
      .object({
        integrationId: z.string(),
      })
      .parse(await request.json());

    console.log("Generating authorization code…");

    const authorizationCode = crypto.randomBytes(16).toString("hex");

    console.log("Saving authorization code…");

    await redis.set(
      `session_code_integration_id:${authorizationCode}`,
      data.integrationId,
      {
        ex: config.sessionCodeExpiry,
      }
    );

    console.log("Done.");

    return NextResponse.json(
      {
        authorizationUrl: `${config.protocol}://${request.headers.get(
          "host"
        )}/auth-request?${config.sessionCodeParam}=${authorizationCode}`,
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
