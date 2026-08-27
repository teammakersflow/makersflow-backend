import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';

@Injectable()
export class QuizQuestionsService {
  constructor(
    private prisma: PrismaService,
    private enrollmentsService: EnrollmentsService,
  ) {}

  create(createQuizQuestionDto: CreateQuizQuestionDto) {
    return this.prisma.quiz_questions.create({
      data: {
        ...createQuizQuestionDto,
        lesson_id: BigInt(createQuizQuestionDto.lesson_id),
      },
    });
  }

  findAll() {
    return this.prisma.quiz_questions.findMany();
  }

  findOne(id: string) {
    return this.prisma.quiz_questions.findUnique({
      where: { id },
    });
  }

  update(
    id: string,
    updateQuizQuestionDto: UpdateQuizQuestionDto,
  ) {
    return this.prisma.quiz_questions.update({
      where: { id },
      data: {
        ...(updateQuizQuestionDto.lesson_id !== undefined && {
          lesson_id: BigInt(updateQuizQuestionDto.lesson_id),
        }),

        ...(updateQuizQuestionDto.question_text !== undefined && {
          question_text: updateQuizQuestionDto.question_text,
        }),

        ...(updateQuizQuestionDto.options !== undefined && {
          options: updateQuizQuestionDto.options,
        }),

        ...(updateQuizQuestionDto.correct_option_index !== undefined && {
          correct_option_index:
            updateQuizQuestionDto.correct_option_index,
        }),

        ...(updateQuizQuestionDto.position !== undefined && {
          position: updateQuizQuestionDto.position,
        }),
      },
    });
  }

  remove(id: string) {
    return this.prisma.quiz_questions.delete({
      where: { id },
    });
  }

    // =========================
  // STUDENT METHODS
  // =========================

  async findByLessonForStudent(
    lessonId: bigint,
    userId: string,
  ) {
    const lesson = await this.prisma.lessons.findUnique({
      where: {
        id: lessonId,
      },
      include: {
        modules: {
          select: {
            course_id: true,
          },
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

    return this.prisma.quiz_questions.findMany({
      where: {
        lesson_id: lessonId,
      },
      select: {
        id: true,
        lesson_id: true,
        question_text: true,
        options: true,
        position: true,
        created_at: true,
      },
      orderBy: {
        position: 'asc',
      },
    });
  }

  async findOneForStudent(
    id: string,
    userId: string,
  ) {
    const question =
      await this.prisma.quiz_questions.findUnique({
        where: {
          id,
        },
      });

    if (!question) {
      throw new NotFoundException(
        'Quiz question not found',
      );
    }

    const lesson = await this.prisma.lessons.findUnique({
      where: {
        id: question.lesson_id,
      },
      include: {
        modules: {
          select: {
            course_id: true,
          },
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

    return {
      id: question.id,
      lesson_id: question.lesson_id,
      question_text: question.question_text,
      options: question.options,
      position: question.position,
      created_at: question.created_at,
    };
  }
}