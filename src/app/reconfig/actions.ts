"use server"; // Ensure this only runs server-side

import { revalidatePath } from "next/cache";
import redis from "../../redis";

export const saveSelectedChannel = async (formData: FormData) => {
  const integrationId = formData.get("integrationId");
  const personActivatedChannel = formData.get("personActivatedChannel");
  const personBirthdayChannel = formData.get("personBirthdayChannel"); // New addition

  await redis.set(
    `slack_channel:person_activated:${integrationId}`,
    personActivatedChannel
  );

  await redis.set( // New addition to handle the birthday channel
    `slack_channel:person_birthday:${integrationId}`,
    personBirthdayChannel
  );

  revalidatePath("/reconfig");
};
