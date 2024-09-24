import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "querystring";

// Request schema for incoming request
const slackRequestSchema = z.object({
    user_id: z.string(),
    text: z.string(),
    team_id: z.string(),
    response_url: z.string(),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        const body = parse(await request.text());
        const data = slackRequestSchema.parse(body);

        // Immediate response to the user
        const immediateResponse = NextResponse.json(
            { text: "Searching the employee directory..." },
            { status: 200 }
        );

        // Send the immediate response to the user
        await fetch(data.response_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(immediateResponse),
        });

        // Trigger the background job by calling the separate route asynchronously
        fetch(`https://slack.worknice.com/worknice/find-employee-profile/get-details`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        }).catch((error) => {
            console.error("Error triggering the background job:", error);
        });

        return immediateResponse;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return new NextResponse(message, { status: 500 });
    }
}