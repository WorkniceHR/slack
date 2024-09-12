import config from "../../config";
import redis from "../../redis";
import { cookies } from "next/headers";

type PageProps<Params extends string = string, SearchParams extends string = string> = {
  params: Record<Params, string>;
  searchParams: Record<SearchParams, string | string[] | undefined>;
};

const ReconfigPage = async ({ searchParams }: PageProps) => {
  const cookieStore = cookies();

  console.log("Retrieving session code…");

  const sessionCode = getSessionCode(cookieStore, searchParams);

  console.log("Retrieving integration ID…");

  const integrationId = await redis.get<string>(`session_code_integration_id:${sessionCode}`);

  if (integrationId === null) {
    throw Error("Unable to retrieve integration ID.");
  }

  return (
    <div>
      <p>Nothing to configure.</p>
    </div>
  );
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
