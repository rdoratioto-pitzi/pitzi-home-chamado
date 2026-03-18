import type { ErrorHandler } from "hono";
import type { AppEnv } from "../index";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  if (err instanceof ZodError) {
    const validationError = fromZodError(err);
    return c.json(
      { success: false, message: "Dados invalidos", details: validationError.message },
      400,
    );
  }

  return c.json(
    { success: false, message: "Erro interno do servidor" },
    500,
  );
};
