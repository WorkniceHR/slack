"use server";

import config from "@/config";
import session from "@/session";
import { redirect } from "next/navigation";
import redis from "../../redis";

export const saveSelectedChannel = async (formData: FormData) => {
  const { integrationId } = await session.getSession();

  const personActivatedChannel = formData.get("personActivatedChannel");
  const calendarUpdateChannel = formData.get("calendarUpdateChannel");
  const newStarterChannel = formData.get("newStarterChannel");

  if (typeof personActivatedChannel !== "string") {
    throw new Error("Person activated channel is required.");
  }

  if (typeof calendarUpdateChannel !== "string") {
    throw new Error("Calendar update channel is required.");
  }

  if (typeof newStarterChannel !== "string") {
    throw new Error("New starter channel is required.");
  }

  await redis.setPersonActivatedSlackChannel(
    integrationId,
    personActivatedChannel
  );

  await redis.setCalendarUpdateSlackChannel(
    integrationId,
    calendarUpdateChannel
  );

  await redis.setNewStarterSlackChannel(integrationId, newStarterChannel);

  redirect(
    `${config.worknice.baseUrl}/admin/apps/integrations/${integrationId}`
  );
};
