import { ReactNode, Ref, RefAttributes } from "react";

export declare module "react" {
  // Support custom property in style props
  interface CSSProperties {
    [key: `--${string}`]: unknown;
  }

  interface HTMLAttributes {
    "data-component"?: string;
  }

  function forwardRef<T, P>(
    render: (props: P, ref: Ref<T>) => ReactNode | null
  ): (props: P & RefAttributes<T>) => ReactNode | null;
}
