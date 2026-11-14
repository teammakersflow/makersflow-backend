
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';

@Injectable()
export class QuizAttemptsService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  findAll(userId: string) {
    return this.prisma.quiz_attempts.findMany({
      where: { user_id: userId },
      orderBy: { attempted_at: 'desc' },
      select: {
        id: true,
        quiz_id: true,
        lesson_id: true,
        score: true,
        answers: true,
        attempted_at: true,
      },
    });
  }

  async submit(
    userId: string,
    lessonIdString: string,
    answers: Record<string, number>,
  ) {
    if (
      !answers ||
      typeof answers !== 'object' ||
      Array.isArray(answers)
    ) {
      throw new BadRequestException('Invalid answers');
    }

    for (const [questionId, selectedIndex] of Object.entries(answers)) {
      if (
        !questionId ||
        !Number.isInteger(selectedIndex) ||
        selectedIndex < 0 ||
        selectedIndex > 3
      ) {
        throw new BadRequestException('Invalid answer selection');
      }
    }

    const lessonId = BigInt(lessonIdString);

    const lesson = await this.prisma.lessons.findUnique({
      where: { id: lessonId },
      include: {
        modules: {
          select: { course_id: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    if (!lesson.is_preview) {
      const enrollment =
        await this.enrollmentsService.findMyEnrollment(
          userId,
          lesson.modules.course_id,
        );

      if (!enrollment) {
        throw new ForbiddenException(
          'You are not enrolled in this course',
        );
      }
    }

    // Lessons whose questions were added before quizzes rows were created
    // automatically have no quizzes row yet. Create it, like quiz-questions does.
    let quiz = await this.prisma.quizzes.findFirst({
      where: { lesson_id: lessonId },
      orderBy: { id: 'asc' },
    });

    if (!quiz) {
      quiz = await this.prisma.quizzes.create({
        data: { lesson_id: lessonId, title: 'Lesson Quiz', questions: [] },
      });
    }

    const questions = await this.prisma.quiz_questions.findMany({
      where: { lesson_id: lessonId },
      orderBy: { position: 'asc' },
      select: {
        id: true,
        correct_option_index: true,
      },
    });

    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions');
    }


const validQuestionIds = new Set(
  questions.map((question) => question.id),
);

for (const questionId of Object.keys(answers)) {
  if (!validQuestionIds.has(questionId)) {
    throw new BadRequestException(
      'One or more submitted answers do not belong to this lesson',
    );
  }
}


    const results: Record<
      string,
      { isCorrect: boolean; correctOptionIndex: number }
    > = {};

    let score = 0;

    for (const question of questions) {
      const selectedIndex = answers[question.id];
      const correctIndex = question.correct_option_index;
      const isCorrect =
        selectedIndex !== undefined &&
        selectedIndex === correctIndex;

      if (isCorrect) {
        score++;
      }

      results[question.id] = {
        isCorrect,
        correctOptionIndex: correctIndex,
      };
    }

    await this.prisma.quiz_attempts.create({
      data: {
        quiz_id: quiz.id,
        lesson_id: lessonId,
        user_id: userId,
        score,
        answers: answers as Prisma.InputJsonValue,
      },
    });

    return {
      score,
      total_questions: questions.length,
      results,
    };
  }
}
