/**
 * Two-wheeler time when the provider has no real two-wheeler routing.
 * TomTom's "motorcycle" (and sometimes Google's) uses car speeds, so it came
 * back identical to the drive. In city traffic bikes and scooters filter
 * through queues, so they lose far less of the jam: free-flow time plus
 * about 40% of the drive's traffic delay. Marked as an estimate in the UI.
 */
export function twoWheelerFromCar(carSeconds: number, freeFlowSeconds: number): number {
  const free = Math.min(freeFlowSeconds, carSeconds);
  const delay = Math.max(0, carSeconds - free);
  return free + delay * 0.4;
}
