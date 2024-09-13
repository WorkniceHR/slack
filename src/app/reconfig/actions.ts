"use server"; // Ensure this is only runs server-side

import { revalidatePath } from "next/cache";
import redis from "../../redis";

export const saveSelectedChannel = async (formData: FormData) => {
  const integrationId = formData.get("integrationId");
  const personActivatedChannel = formData.get("personActivatedChannel");

  await redis.set(
    `slack_channel:person_activated:${integrationId}`,
    personActivatedChannel
  );

  revalidatePath("/reconfig");
};
