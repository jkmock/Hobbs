import { z } from "zod";

// For routes like /aircraft/:id, /flights/:id
export const IdParamsSchema = z.object({
  id: z.uuid(),
});
export type IdParams = z.infer<typeof IdParamsSchema>;