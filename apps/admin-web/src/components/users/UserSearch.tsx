"use client";
import React from "react";
import { Search, Xmark } from "iconoir-react";

interface UserSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const UserSearch: React.FunctionComponent<UserSearchProps> = ({ value, onChange, placeholder = "Search by email, username, or wallet address..." }) => {
  return (
    <div className="border-input bg-background ring-offset-background focus-within:ring-ring flex h-10 items-center gap-2 rounded-md border px-3 focus-within:ring-2 focus-within:ring-offset-2">
      <Search className="text-muted-foreground h-4 w-4 shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground shrink-0" aria-label="Clear search">
          <Xmark className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default UserSearch;
