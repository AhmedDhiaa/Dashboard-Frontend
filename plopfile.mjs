import { register } from "tsx/esm/api"

// Register tsx programmatically so plop-templates/index.ts loads as TypeScript.
// (`node --loader tsx` is deprecated; tsx's own register() is the modern path.)
register()

export default async function (plop) {
  const { default: setup } = await import("./plop-templates/index.ts")
  return setup(plop)
}
