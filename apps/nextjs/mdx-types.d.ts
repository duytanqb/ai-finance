declare module "mdx/types" {
  import type { ComponentType } from "react";

  export type MDXComponents = Record<string, ComponentType<any>>;
}
