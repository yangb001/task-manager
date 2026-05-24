import React, { useState } from 'react';
import { ThemeProvider } from './stores/themeStore';
import { AppLayout } from './pages/AppLayout';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
  );
};

export default App;