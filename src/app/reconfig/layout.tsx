import "@worknice/whiteboard/shared.css";

import brandFont from "@/fonts/brandFont";
import BaseLayout from "@worknice/whiteboard/layouts/BaseLayout";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

const MinimalRootLayout = ({ children }: Props) => (
  <BaseLayout brandTypeface={brandFont.style.fontFamily}>{children}</BaseLayout>
);

export default MinimalRootLayout;
