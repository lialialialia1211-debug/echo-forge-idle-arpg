import { CombatArena } from "../game/ui/arena/CombatArena";
import { ErrorBoundary } from "./ErrorBoundary";

export function App() {
  return (
    <ErrorBoundary>
      <CombatArena />
    </ErrorBoundary>
  );
}
