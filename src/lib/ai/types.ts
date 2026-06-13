export type MealSuggestion = { meal: string; idea: string; approxCalories: number };
export type WorkoutDayContent = { focus: string; exercises: string[] };

export type PlanContent = {
  summary: string;
  nutrition: { dailyNote: string; meals: MealSuggestion[] };
  workout: WorkoutDayContent[];
};

export type PlanInputs = {
  targets: { calories: number; proteinG: number; fatG: number; carbsG: number };
  skeleton: { setsPerExercise: number; repRange: string; days: { focus: string }[] };
  profile: { goal: string; experience: string; cautious: boolean };
};

export interface AiProvider {
  generatePlanContent(inputs: PlanInputs): Promise<PlanContent | null>;
}
