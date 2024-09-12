import config from "@/config";
import redis from "@/services/redis";
import { Logger } from "next-axiom";
import { cookies } from "next/headers";
import ConfigForm from "./ConfigForm"; // Import the Client Component

type PageProps<Params extends string = string, SearchParams extends string = string> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
};

const ReconfigPage = async ({ searchParams }: PageProps) => {
  const cookieStore = cookies();
  const log = new Logger();

  log.info("Retrieving session code…");

  const sessionCode = getSessionCode(cookieStore, searchParams);

  log.info("Retrieving integration ID…");

  const integrationId = await redis.getIntegrationId(sessionCode);

  if (integrationId === null) {
    throw Error("Unable to retrieve integration ID.");
  }

  log.info("Retrieving config info…");

  const automaticMatching = await redis.getAutomaticMatching(integrationId);

  await log.flush();

  // Render the client-side form with the fetched data
  return <ConfigForm automaticMatching={automaticMatching} sessionCode={sessionCode} />;
};

const getSessionCode = (
  cookieStore: ReturnType<typeof cookies>,
  searchParams: PageProps["searchParams"],
) => {
  const param = searchParams[config.sessionCodeParam];

  if (typeof param === "string") return param;

  const sessionCodeCookie = cookieStore.get(config.sessionCodeCookieName);

  if (sessionCodeCookie !== undefined) return sessionCodeCookie.value;

  throw Error("Unable to retrieve session code.");
};

export default ReconfigPage;
