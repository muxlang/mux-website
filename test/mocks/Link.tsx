import * as React from "react";

export default function Link({
  to,
  children,
  ...props
}: React.ComponentProps<"a"> & { to?: string }) {
  return (
    <a href={to} {...props}>
      {children}
    </a>
  );
}
