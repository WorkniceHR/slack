import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parse } from "querystring";

// Define schema for request validation
const requestSchema = z.object({
    enterprise_id: z.string(),
});

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        // Parse the x-www-form-urlencoded data
        const body = parse(await request.text());

        // Validate and parse the incoming request
        const data = requestSchema.parse(body);

        return NextResponse.json({
            response_type: "in_channel", 
            text: `Hello, the enterprise ID is: ${data.enterprise_id}`,
        }, { status: 200 });

    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return new NextResponse(message, { status: 500 });
    }
};
