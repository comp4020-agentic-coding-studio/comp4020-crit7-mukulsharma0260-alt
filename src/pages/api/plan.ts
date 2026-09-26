import type { APIRoute } from "astro";
import { listCourses, savePlan } from "../../lib/db";

// Validates before writing anything, so a rejected submission leaves the
// stored plan untouched rather than partially overwriting it. Every failure
// redirects back to "/" with an `error` code the homepage can read and show;
// success redirects with `saved=1`. No client-side JS either way — same
// POST + 303 pattern as /api/messages.
export const POST: APIRoute = async ({ request, redirect }) => {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/?error=malformed", 303);
  }

  const candidates = form
    .getAll("candidate")
    .map((value) => String(value).trim())
    .filter((value) => value !== "");
  if (candidates.length > 1) {
    return redirect("/?error=multiple_candidates", 303);
  }
  const candidate = candidates[0] ?? null;

  const currentRaw = form
    .getAll("current")
    .map((value) => String(value).trim())
    .filter((value) => value !== "");
  const currentSet = new Set(currentRaw);
  if (currentSet.size !== currentRaw.length) {
    return redirect("/?error=duplicate_current", 303);
  }

  const validCodes = new Set(listCourses().map((course) => course.code));
  for (const code of currentSet) {
    if (!validCodes.has(code)) {
      return redirect("/?error=unknown_course", 303);
    }
  }
  if (candidate !== null) {
    if (!validCodes.has(candidate)) {
      return redirect("/?error=unknown_course", 303);
    }
    if (currentSet.has(candidate)) {
      return redirect("/?error=candidate_conflict", 303);
    }
  }

  savePlan({ current: [...currentSet], candidate });
  return redirect("/?saved=1", 303);
};
