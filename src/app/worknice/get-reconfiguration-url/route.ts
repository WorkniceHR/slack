import { NextRequest, NextResponse } from "next/server";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {

    return NextResponse.json(
      {
        authorizationUrl: "https://slack.worknice.com/reconfig",
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : `${error}`;

    return new NextResponse(message, {
      status: 500,
    });
  }
};



