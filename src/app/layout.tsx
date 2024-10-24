import "@worknice/whiteboard/dist/shared.css";
import type { ReactNode } from "react";
import "./layout.css";

type Props = {
  children: ReactNode;
};

const RootLayout = ({ children }: Props) => (
  <html lang="en">
    <head>
      <title>Slack integration for Worknice</title>
    </head>
    <body>{children}</body>
  </html>
);

export default RootLayout;
