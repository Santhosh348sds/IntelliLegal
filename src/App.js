import { useIsAuthenticated } from '@azure/msal-react';
import Home  from './pages/Home';
import Login from './pages/Login';

function App() {
  const isAuthenticated = useIsAuthenticated();
  return isAuthenticated ? <Home /> : <Login />;
}

export default App;
