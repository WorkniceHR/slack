import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "querystring";
import redis from "../../../redis";

// Updated schema with new fields
const requestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
});

async function getIntegrationId(team_id: string) {
    console.log("Retrieving integration ID for team ID:", team_id);

    // Get all keys matching the pattern slack_team_id:*
    const keys = await redis.keys('slack_team_id:*');

    // Iterate through the keys and find the one that matches the team_id
    for (const key of keys) {
        const storedTeamId = await redis.get(key);

        // If the team_id matches, extract the integrationId from the key
        if (storedTeamId === team_id) {
            const integrationId = key.split(':')[1];  // Extract integrationId from key
            console.log(`Found integration ID: ${integrationId}`);
            return integrationId;
        }
    }

    throw Error("Unable to retrieve integration ID for the given team ID.");
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
