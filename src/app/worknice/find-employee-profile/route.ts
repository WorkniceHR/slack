import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Define schema for request validation
const requestSchema = z.object({
    enterprise_id: z.string(),
  });

export const POST = async (request: NextRequest): Promise<NextResponse> => {
    try {
        // Validate and parse the incoming request
        const data = requestSchema.parse(await request.json());

        return NextResponse.json({
            test: "hello",
            enterprise_id: data.enterprise_id,
        }, { status: 200 });

    } catch (error) {
        const message = error instanceof Error ? error.message : `${error}`;
        return new NextResponse(message, { status: 500 });
    }
};


