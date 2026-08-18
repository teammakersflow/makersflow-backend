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

  update(id: string, updateQuizQuestionDto: UpdateQuizQuestionDto) {
    const { lesson_id, ...data } = updateQuizQuestionDto;

    return this.prisma.quiz_questions.update({
      where: { id },
      data: {
        ...data,
        ...(lesson_id !== undefined
          ? { lesson_id: BigInt(lesson_id) }
          : {}),
      },
    });
  }

  remove(id: string) {
    return this.prisma.quiz_questions.delete({
      where: { id },
    });
  }
}