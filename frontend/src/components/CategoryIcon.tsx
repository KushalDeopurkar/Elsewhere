import {
  Cpu,
  Briefcase,
  GraduationCap,
  Palette,
  Barbell,
  MusicNotes,
  UsersThree,
  ForkKnife,
  Leaf,
  Mountains,
  Balloon,
  Martini,
  Sparkle,
} from "@phosphor-icons/react/ssr";
import type { EventCategory } from "@/lib/types";

const ICONS = {
  tech: Cpu,
  business: Briefcase,
  education: GraduationCap,
  arts: Palette,
  sports: Barbell,
  music: MusicNotes,
  community: UsersThree,
  food: ForkKnife,
  health: Leaf,
  outdoor: Mountains,
  family: Balloon,
  nightlife: Martini,
  other: Sparkle,
} as const;

export default function CategoryIcon({
  category,
  size = 20,
  weight = "duotone",
}: {
  category: EventCategory;
  size?: number;
  weight?: "duotone" | "bold" | "fill" | "regular";
}) {
  const Icon = ICONS[category] ?? Sparkle;
  return <Icon size={size} weight={weight} aria-hidden="true" />;
}
