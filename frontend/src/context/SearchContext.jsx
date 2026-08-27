import React, { createContext, useContext, useState } from 'react';

const SearchContext = createContext({
  searchQuery: '',
  setSearchQuery: () => {},
  activeFilter: 'all',
  setActiveFilter: () => {},
  refreshKey: 0,
  triggerRefresh: () => {}
});

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <SearchContext.Provider value={{
      searchQuery,
      setSearchQuery,
      activeFilter,
      setActiveFilter,
      refreshKey,
      triggerRefresh
    }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => useContext(SearchContext);
