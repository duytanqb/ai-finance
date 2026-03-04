declare module "mdx/types" {
  import type { ComponentType } from "react";

  // biome-ignore lint/suspicious/noExplicitAny: MDX component props are inherently dynamic
  export type MDXComponents = Record<string, ComponentType<any>>;
}
