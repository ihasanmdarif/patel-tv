import { redirect } from "next/navigation";

// Profiles management moved into Settings → Sources. Kept as a redirect rather than
// removed outright in case anything external still links here.
export default function ProfilesPage() {
  redirect("/settings?tab=sources");
}
