import crypto from "crypto";
import { cookies } from "next/headers";
import config from "./config";
import redis from "./redis";

const getSession = async (sessionCode?: string | null | undefined) => {
  const cookieStore = await cookies();

  if (sessionCode) {
    const integrationId = await redis.getAndDeleteIntegrationIdFromSessionCode(
      sessionCode
    );

    if (integrationId === null) {
      throw Error("Invalid session code.");
    }

    const sessionToken = crypto.randomBytes(64).toString("hex");

    await redis.setIntegrationIdFromSessionToken(sessionToken, integrationId);

    cookieStore.set(config.sessionTokenCookieName, sessionToken, {
      maxAge: config.sessionTokenExpiry,
    });

    return {
      integrationId,
    };
  }

  const sessionTokenCookie = cookieStore.get(config.sessionTokenCookieName);

  if (sessionTokenCookie === undefined) {
    throw Error("Unable to retrieve session token.");
  }

  const integrationId = await redis.getIntegrationIdFromSessionToken(
    sessionTokenCookie.value
  );

  if (integrationId === null) {
    throw Error("Invalid session token.");
  }

  return {
    integrationId,
  };
};

const session = {
  getSession,
};

export default session;
