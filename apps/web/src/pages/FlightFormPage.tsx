import { useParams } from 'react-router'

// One form for both routes:
//   /flights/new       -> id is undefined -> POST /flights
//   /flights/:id/edit  -> id is set       -> load with GET, save with PUT
//
// TODO (step 7):
//  - fields from CreateFlightSchema: date, aircraft, instructor, legs, times, landings, notes
//  - legs: an array in state with "add leg" / "remove leg" buttons
//  - validate with CreateFlightSchema.safeParse(), show issues next to fields
//  - useMutation; on success invalidate ['flights'] and navigate('/')
export default function FlightFormPage() {
  const { id } = useParams()
  return (
    <section>
      <h1>{id ? 'Edit flight' : 'Log a flight'}</h1>
    </section>
  )
}
