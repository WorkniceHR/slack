import { z } from "zod";
import { createZodFetcher } from "zod-fetch";
import config from "./config";

const fetchWithZod = createZodFetcher();

const getAccessToken = async (code: string) =>
  fetchWithZod(
    z
      .object({
        access_token: z.string(),
        ok: z.literal(true),
        bot_user_id: z.string(),
        team: z.object({
          name: z.string(),
          id: z.string(),
        }),
        enterprise: z
          .object({
            id: z.string(),
          })
          .nullable(),
      })
      .passthrough(),
    "https://slack.com/api/oauth.v2.access",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code,
      }),
    }
  );

const getAuthorizationUrl = async () =>
  `https://slack.com/oauth/v2/authorize?scope=${config.slack.scopes.join(
    ","
  )}&client_id=${config.slack.clientId}&redirect_uri=${encodeURIComponent(
    config.slack.redirectUri
  )}`;

const listChannels = async (token: string) => {
  const response = await fetch("https://slack.com/api/conversations.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Slack channels.");
  }

  const data = await response.json();

  return data.channels as Array<Channel>;
};

const listUsers = async (token: string) => {
  const response = await fetch("https://slack.com/api/users.list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Slack users.");
  }

  const data = await response.json();

  const users = data.members as Array<User>;

  return users.filter(
    (user) =>
      user.deleted === false && user.is_bot === false && user.id !== "USLACKBOT"
  );
};

const postChatMessage = async (
  token: string,
  channel: string,
  context:
    | { text: string; blocks?: Array<Block> }
    | { text?: string; blocks: Array<Block> }
) => {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, ...context }),
  });

  if (!response.ok) {
    throw new Error(
      `HTTP error! ${response.statusText} ${response.statusText}`
    );
  }
};

export type Block = {
  type: "section";
  text: {
    type: "mrkdwn";
    text: string;
  };
  accessory?: {
    type: "image";
    image_url: string;
    alt_text: string;
  };
};

export type Channel = {
  id: string;
  name: string;
  is_channel: boolean;
};

export type User = {
  deleted: boolean;
  id: string;
  is_bot: boolean;
  profile: {
    email: string;
    display_name: string;
    real_name: string;
  };
};

const slack = {
  getAccessToken,
  getAuthorizationUrl,
  listChannels,
  listUsers,
  postChatMessage,
};

export default slack;
