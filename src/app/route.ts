import redis from "../redis";

export const GET = async () => {
  const dbSize = await redis.dbsize();
  return Response.json({ dbSize });
};
