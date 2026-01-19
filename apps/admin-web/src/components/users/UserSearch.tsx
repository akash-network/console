"use client";
import React from "react";
import { Input } from "@akashnetwork/ui/components";
import { Search } from "iconoir-react";

interface UserSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const UserSearch: React.FunctionComponent<UserSearchProps> = ({ value, onChange, placeholder = "Search by email, username, or wallet address..." }) => {
  return (
    <div className="relative">
      <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input type="text" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} className="pl-10" />
    </div>
  );
};

export default UserSearch;
