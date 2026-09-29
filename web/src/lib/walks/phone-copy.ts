export function phoneNextStopCopy(input: { nextHeading: string | null; nextNote: string | null; taskCount: number }): {
  heading: string;
  detail: string;
} {
  if (input.taskCount <= 0) {
    return { heading: "No stops", detail: "There are no stops for this walk and block." };
  }
  if (input.nextHeading && input.nextNote) return { heading: input.nextHeading, detail: input.nextNote };
  return { heading: "No stop ahead", detail: "Every task on this walk is checked or skipped." };
}
