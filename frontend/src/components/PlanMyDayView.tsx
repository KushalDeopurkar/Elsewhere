"use client";

import DayPlanner from "./DayPlanner";
import LocationSelector from "./LocationSelector";
import { useCity } from "@/lib/cityPref";

export default function PlanMyDayView() {
  const city = useCity();
  return (
    <>
      <div className="shell planner-city">
        <span>Planning in</span> <LocationSelector />
      </div>
      <DayPlanner key={city.name} city={city.name} />
    </>
  );
}
