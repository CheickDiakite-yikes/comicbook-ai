import { AppProviders } from "@/providers/AppProviders";
import { AppLayout } from "@/components/layout/AppLayout";

function App() {
  return (
    <AppProviders>
      <AppLayout />
    </AppProviders>
  );
}

export default App;
