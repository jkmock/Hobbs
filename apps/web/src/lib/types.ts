// Shapes of the JSON the API sends back. Request bodies use the Zod types
// from @hobbs/shared instead (e.g. z.infer<typeof CreateFlightSchema>).

export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
}

// TODO (step 6+): add Flight, Leg, Aircraft, Instructor to match the API's *_COLUMNS.

export type Page<T> = {
  items: T[]
  nextCursor: string | null
}
