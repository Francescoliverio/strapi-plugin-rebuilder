import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import HomePage from '../HomePage';

const queryClient = new QueryClient();

const App: React.VoidFunctionComponent = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>
  );
};

export default App;
