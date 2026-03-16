import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export async function logActivityEvent(params: {
  userId: string | null | undefined;
  type: string;
  payload?: Record<string, any>;
}) {
  const { userId, type, payload } = params;
  if (!userId) return;
  try {
    await addDoc(collection(db, "activity_events"), {
      user_id: userId,
      type,
      payload: payload ?? {},
      created_at: serverTimestamp(),
    } as any);
  } catch {
    // ignore
  }
}
