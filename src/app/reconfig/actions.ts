"use server"; // Ensure this only runs server-side

import { redirect } from "next/navigation";
import redis from "../../redis";

export const saveSelectedChannel = async (formData: FormData) => {
  const integrationId = formData.get("integrationId");
  const personActivatedChannel = formData.get("personActivatedChannel");
  const calendarUpdateChannel = formData.get("calendarUpdateChannel");
  const newStarterChannel = formData.get("newStarterChannel");

  await redis.set(
    `slack_channel:person_activated:${integrationId}`,
    personActivatedChannel
  );

  await redis.set(
    `slack_channel:calendar_update:${integrationId}`,
    calendarUpdateChannel
  );

  await redis.set(
    `slack_channel:new_starter:${integrationId}`,
    calendarUpdateChannel
  );

  // Redirect back to the integration page after saving
  redirect(`https://app.worknice.com/admin/apps/integrations/${integrationId}`);
};
