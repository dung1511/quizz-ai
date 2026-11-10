import { DocumentChapter, DifficultyLevel, ExamMatrix, ChapterDistribution } from '../types';

/**
 * Creates the Exam Matrix / Blueprint
 */
export function buildExamMatrix(
  chapters: DocumentChapter[],
  totalQuestions: number,
  difficulty: DifficultyLevel
): ExamMatrix {
  const chapterCount = Math.max(1, chapters.length);
  const basePerChapter = Math.floor(totalQuestions / chapterCount);
  const remainder = totalQuestions % chapterCount;

  const distributions: ChapterDistribution[] = chapters.map((chap, idx) => {
    const chapterTotal = basePerChapter + (idx < remainder ? 1 : 0);

    let easy = 0;
    let medium = 0;
    let hard = 0;

    if (difficulty === 'easy') {
      easy = Math.round(chapterTotal * 0.7);
      medium = Math.round(chapterTotal * 0.25);
      hard = chapterTotal - easy - medium;
    } else if (difficulty === 'hard') {
      hard = Math.round(chapterTotal * 0.6);
      medium = Math.round(chapterTotal * 0.3);
      easy = chapterTotal - hard - medium;
    } else {
      // Default: Medium / Balanced
      easy = Math.round(chapterTotal * 0.3);
      medium = Math.round(chapterTotal * 0.5);
      hard = chapterTotal - easy - medium;
    }

    // Ensure sum equals chapterTotal
    const sum = easy + medium + hard;
    if (sum !== chapterTotal) {
      medium += chapterTotal - sum;
    }

    return {
      chapterId: chap.id,
      chapterTitle: chap.title,
      easy: Math.max(0, easy),
      medium: Math.max(0, medium),
      hard: Math.max(0, hard),
      total: chapterTotal,
    };
  });

  const totalEasy = distributions.reduce((acc, d) => acc + d.easy, 0);
  const totalMedium = distributions.reduce((acc, d) => acc + d.medium, 0);
  const totalHard = distributions.reduce((acc, d) => acc + d.hard, 0);

  return {
    chapterDistributions: distributions,
    totalEasy,
    totalMedium,
    totalHard,
    grandTotal: totalQuestions,
  };
}
