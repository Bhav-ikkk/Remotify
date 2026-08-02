"use client";

import { Theme } from "@radix-ui/themes";

export default function Providers({ children }) {
  return (
    <Theme
      appearance="light"
      accentColor="teal"
      grayColor="slate"
      radius="medium"
      scaling="100%"
    >
      {children}
    </Theme>
  );
}
