// ---- CHANGED (C8): imports GameController instead of Lobby ----
// ---- CHANGED: ErrorProvider wraps GameController so all children can access error state ----
import { ErrorProvider } from './ErrorContext';
import GameController from './GameController';

function App() {
  return (
    <ErrorProvider>
      <GameController />
    </ErrorProvider>
  );
}

export default App;
// ---- CHANGED ABOVE ----
