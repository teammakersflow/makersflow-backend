import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { UpdateQuizQuestionDto } from './dto/update-quiz-question.dto';

@Injectable()
export class QuizQuestionsService {
  constructor(private prisma: PrismaService) {}

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
}