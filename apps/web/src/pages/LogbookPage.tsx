import { Link } from 'react-router'

// TODO (step 6): list the user's flights.
//  - useInfiniteQuery with queryKey ['flights'], calling api<Page<Flight>>(`/flights?cursor=...`)
//  - getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
//  - one row per flight: date, route (legs), tail number, total time
//  - a "Load more" button that calls fetchNextPage() while hasNextPage
export default function LogbookPage() {
  return (
    <section>
      <h1>Logbook</h1>
      <Link to="/flights/new">+ Log a flight</Link>
    </section>
  )
}
