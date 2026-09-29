"use client";

import type { SelectHTMLAttributes } from "react";

export function InstantSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      onChange={(event) => {
        props.onChange?.(event);
        if (!event.defaultPrevented) {
          event.currentTarget.form?.requestSubmit();
        }
      }}
    />
  );
}
