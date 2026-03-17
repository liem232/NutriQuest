import confetti from "canvas-confetti";
import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

type Profile = {
  protein_goal: number;
  fat_goal: number;
  carbs_goal: number;
  weight: number;
};

const TITLE_THRESHOLDS = [
  { min: 0, title: "Новичок" },
  { min: 7, title: "Любитель" },
  { min: 30, title: "Спортсмен" },
  { min: 90, title: "Профи" },
  { min: 180, title: "Эксперт" },
  { min: 365, title: "Легенда" },
];

export function getTitleForDays(days: number): string {
  let result = "Новичок";
  for (const t of TITLE_THRESHOLDS) {
    if (days >= t.min) result = t.title;
  }
  return result;
}

export async function checkAndUpdateStreak(userId: string) {
  const profileRef = doc(db, "profiles", userId);
  const profileSnap = await getDoc(profileRef);
  const profile: any = profileSnap.exists() ? profileSnap.data() : null;
  if (!profile) return;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Check if user has diary entries for today
  const todayEntriesCount = await getCountFromServer(
    query(collection(db, "food_diary"), where("user_id", "==", userId), where("date", "==", today))
  );
  if (todayEntriesCount.data().count === 0) return;

  let newStreak = profile.streak_days;
  let newTotal = profile.total_days;

  if (profile.last_active_date !== today) {
    if (profile.last_active_date === yesterday) {
      newStreak = profile.streak_days + 1;
    } else {
      newStreak = 1;
    }
    newTotal = profile.total_days + 1;
  }

  const newTitle = getTitleForDays(newTotal);
  const bestStreak = Math.max((profile as any).best_streak ?? 0, newStreak);

  await updateDoc(profileRef, {
    streak_days: newStreak,
    total_days: newTotal,
    last_active_date: today,
    title: newTitle,
    best_streak: bestStreak,
  } as any);

  // Update daily_stats
  await updateDailyStats(userId, today);

  // Check achievements
  await checkAchievements(userId, newStreak, newTotal);
}

async function updateDailyStats(userId: string, date: string) {
  const entriesSnap = await getDocs(
    query(collection(db, "food_diary"), where("user_id", "==", userId), where("date", "==", date))
  );
  const entries = entriesSnap.docs.map((d) => d.data() as any);
  if (entries.length === 0) return;

  let totalCal = 0, totalP = 0, totalF = 0, totalC = 0;
  entries.forEach((e: any) => {
    const mult = e.grams / 100;
    const product = e.product ?? e.product_snapshot ?? e.products ?? {};
    totalCal += Math.round((Number(product.calories_per_100g) || 0) * mult);
    totalP += Math.round(((Number(product.protein_per_100g) || 0) * mult) * 100) / 100;
    totalF += Math.round(((Number(product.fat_per_100g) || 0) * mult) * 100) / 100;
    totalC += Math.round(((Number(product.carbs_per_100g) || 0) * mult) * 100) / 100;
  });

  const profileSnap = await getDoc(doc(db, "profiles", userId));
  const profile: any = profileSnap.exists() ? profileSnap.data() : null;
  const dailyCalories = Number(profile?.daily_calories) || 0;
  const goalAchieved = dailyCalories
    ? totalCal >= dailyCalories * 0.9 && totalCal <= dailyCalories * 1.1
    : false;

  // Upsert daily stats
  await setDoc(
    doc(db, "daily_stats", `${userId}_${date}`),
    {
      user_id: userId,
      date,
      total_calories: Math.round(totalCal),
      total_protein: totalP,
      total_fat: totalF,
      total_carbs: totalC,
      goal_achieved: goalAchieved,
      updated_at: serverTimestamp(),
    } as any,
    { merge: true }
  );
}

async function checkAchievements(userId: string, streak: number, totalDays: number) {
  const [allAchievementsSnap, userAchSnap] = await Promise.all([
    getDocs(query(collection(db, "achievements"))),
    getDocs(query(collection(db, "user_achievements"), where("user_id", "==", userId))),
  ]);

  const allAchievements = allAchievementsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  const earned = new Set(userAchSnap.docs.map((d) => String((d.data() as any)?.achievement_id ?? "")));

  for (const achievement of allAchievements) {
    if (earned.has(achievement.id)) continue;

    let unlocked = false;

    switch (achievement.condition_type) {
      case "streak":
        unlocked = streak >= achievement.condition_value;
        break;
      case "total_days":
        unlocked = totalDays >= achievement.condition_value;
        break;
      case "products_added": {
        const cnt = await getCountFromServer(query(collection(db, "food_diary"), where("user_id", "==", userId)));
        unlocked = cnt.data().count >= achievement.condition_value;
        break;
      }
    }

    if (unlocked) {
      await addDoc(collection(db, "user_achievements"), {
        user_id: userId,
        achievement_id: achievement.id,
        earned_at: serverTimestamp(),
      } as any);

      const reward = Number(achievement.xp_reward) || 0;
      if (reward > 0) {
        await updateDoc(doc(db, "profiles", userId), { xp: increment(reward) } as any);
      }

      // Confetti!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }
}

export function getRecommendations(
  profile: Profile,
  todayProtein: number,
  todayFat: number,
  todayCarbs: number,
  todayCalories: number,
  lastMealTime?: Date
) {
  const recs: { icon: string; title: string; desc: string; products: string[] }[] = [];

  if (todayProtein < profile.protein_goal * 0.5) {
    recs.push({
      icon: "solar:drumstick-bold-duotone",
      title: "Больше белка",
      desc: "Вы не добрали по белку. Добавьте продукты с высоким содержанием белка.",
      products: ["Куриная грудка", "Творог 5%", "Яйцо куриное", "Тунец", "Индейка филе"],
    });
  }

  if (todayCarbs < profile.carbs_goal * 0.4) {
    recs.push({
      icon: "solar:baguette-bold-duotone",
      title: "Сложные углеводы",
      desc: "Добавьте полезные источники углеводов для энергии.",
      products: ["Гречка", "Овсянка", "Рис бурый", "Киноа", "Хлеб цельнозерновой"],
    });
  }

  if (todayFat < profile.fat_goal * 0.4) {
    recs.push({
      icon: "solar:chef-hat-bold-duotone",
      title: "Полезные жиры",
      desc: "Не забывайте о жирах — они важны для гормонального баланса.",
      products: ["Авокадо", "Лосось", "Орехи", "Оливковое масло"],
    });
  }

  const waterLiters = Math.round(Number(profile.weight) * 0.033 * 10) / 10;
  recs.push({
    icon: "solar:cup-hot-bold-duotone",
    title: "Пейте воду",
    desc: `Ваша норма воды: ${waterLiters} л в день при весе ${profile.weight} кг.`,
    products: [],
  });

  if (lastMealTime) {
    const hoursSince = (Date.now() - lastMealTime.getTime()) / 3600000;
    if (hoursSince > 4) {
      recs.push({
        icon: "solar:apple-pie-bold-duotone",
        title: "Пора перекусить",
        desc: `Последний приём пищи был ${Math.round(hoursSince)} часов назад. Не голодайте!`,
        products: ["Яблоко", "Йогурт натуральный", "Банан", "Орехи"],
      });
    }
  }

  return recs;
}
