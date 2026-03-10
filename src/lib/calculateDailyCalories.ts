export type GenderType = "male" | "female";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "lose" | "maintain" | "gain";

export function calculateDailyCalories(params: {
  weight: number;
  height: number;
  age: number;
  gender: GenderType;
  activity: ActivityLevel;
  goal: GoalType;
}): { calories: number; protein: number; fat: number; carbs: number } {
  const { weight, height, age, gender, activity, goal } = params;

  const bmr = gender === "male"
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;

  let multiplier = 1.55;
  switch (activity) {
    case "sedentary":
      multiplier = 1.2;
      break;
    case "light":
      multiplier = 1.375;
      break;
    case "moderate":
      multiplier = 1.55;
      break;
    case "active":
      multiplier = 1.725;
      break;
    case "very_active":
      multiplier = 1.9;
      break;
  }

  let goalAdj = 1.0;
  switch (goal) {
    case "lose":
      goalAdj = 0.85;
      break;
    case "gain":
      goalAdj = 1.15;
      break;
    case "maintain":
      goalAdj = 1.0;
      break;
  }

  const tdee = Math.round(bmr * multiplier * goalAdj);

  const calories = tdee;
  const protein = Math.round((tdee * 0.3) / 4);
  const fat = Math.round((tdee * 0.25) / 9);
  const carbs = Math.round((tdee * 0.45) / 4);

  return { calories, protein, fat, carbs };
}
