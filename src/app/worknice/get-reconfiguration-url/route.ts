import { NextRequest, NextResponse } from "next/server";

    return NextResponse.json(
      {
        reconfigurationUrl: "https://slack.worknice.com/reconfig",
      },
      { status: 200 },
    );
