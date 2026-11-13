/**
 * Course completion rule, shared by GET /lesson-progress/my/course/:courseId
 * and certificate eligibility (POST /certificates/me).
 *
 * A course is complete when it has at least one lesson and every lesson that
 * CURRENTLY belongs to the course has a completed lesson_progress row.
 *
 * lesson_progress has no foreign key to lessons, so rows can remain for
 * lessons that were deleted or moved to another course. Those rows are
 * ignored: they must neither block completion (completed > total never
 * equals total) nor grant it (a stale completed row standing in for a current
 * lesson that is not completed). Duplicate rows for one lesson count once.
 *
 * The percentage never exceeds 100 and is never 100 for an unfinished course
 * (e.g. 199/200 would round to 100).
 */
export interface CompletionLesson {
  id: bigint;
}

export interface CompletionProgress {
  lesson_id: bigint;
  is_completed: boolean;
}

export interface CourseCompletion {
  total_lessons: number;
  completed_lessons: number;
  completion_percentage: number;
  is_completed: boolean;
}

export function computeCourseCompletion(
  lessons: CompletionLesson[],
  progress: CompletionProgress[],
): CourseCompletion {
  const currentLessonIds = new Set(
    lessons.map((lesson) => lesson.id.toString()),
  );

  const completedLessonIds = new Set(
    progress
      .filter(
        (item) =>
          item.is_completed &&
          currentLessonIds.has(item.lesson_id.toString()),
      )
      .map((item) => item.lesson_id.toString()),
  );

  const totalLessons = currentLessonIds.size;
  const completedLessons = completedLessonIds.size;
  const isCompleted =
    totalLessons > 0 && completedLessons === totalLessons;

  let completionPercentage = 0;
  if (totalLessons > 0) {
    completionPercentage = isCompleted
      ? 100
      : Math.min(
          99,
          Math.round((completedLessons / totalLessons) * 100),
        );
  }

  return {
    total_lessons: totalLessons,
    completed_lessons: completedLessons,
    completion_percentage: completionPercentage,
    is_completed: isCompleted,
  };
}
