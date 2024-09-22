import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "querystring";
import config from "../../../config";
import redis from "../../../redis";

// Updated schema with new fields
const requestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
});

async function getIntegrationId(team_id) {
  console.log("Retrieving integration ID for team ID:", team_id);

  const integrationId = await redis.get(`slack_team_id:${team_id}`);

  if (integrationId === null) {
    throw Error("Unable to retrieve integration ID.");
  }

  return integrationId;
}


export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        // Parse the x-www-form-urlencoded data
        const body = parse(await request.text());

        // Validate and parse the incoming request
        const data = requestSchema.parse(body);
        
        // Retrieve the integration ID based on the team_id 
        const integrationId = await getIntegrationId(data.team_id);

        return NextResponse.json({
            response_type: "in_channel", 
            text: `Received command: ${data.text}, from user ID: ${data.user_id}, in team ID: ${data.team_id}, Worknice Integration ID is: ${integrationId}`,
        }, { status: 200 });

    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return new NextResponse(message, { status: 500 });
    }
};
