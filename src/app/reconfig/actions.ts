"use server"; // Ensure this only runs server-side

import { redirect } from "next/navigation";
import redis from "../../redis";

export const saveSelectedChannel = async (formData: FormData) => {
  const integrationId = formData.get("integrationId");
  const personActivatedChannel = formData.get("personActivatedChannel");
  const calendarUpdateChannel = formData.get("calendarUpdateChannel");
  const newStarterChannel = formData.get("newStarterChannel");

  if (typeof integrationId !== "string") {
    throw new Error("Integration ID is required.");
  }

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

  // Redirect back to the integration page after saving
  redirect(`https://app.worknice.com/admin/apps/integrations/${integrationId}`);
};
