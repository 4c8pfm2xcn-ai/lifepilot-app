import { Suspense } from "react";
import { TasksScreen } from "@/components/screens/tasks";

export const metadata = { title: "Tasks" };

export default function Page() {
  return (
    <Suspense>
      <TasksScreen />
    </Suspense>
  );
}
