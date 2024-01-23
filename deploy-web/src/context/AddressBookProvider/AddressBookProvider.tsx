"use client";
import React, { useState } from "react";
import { useAddressNames } from "@src/queries/useAddressNames";
import { EditAddressBookmarkModal } from "@src/context/AddressBookProvider/EditAddressBookmarkModal";

type ContextType = {
  isLoading: boolean;
  addressNames: { [key: string]: string };
  editAddressName: (address: string) => void;
};

const AddressBookProviderContext = React.createContext<ContextType>({
  isLoading: false,
  addressNames: {},
  editAddressName: null
});

export const AddressBookProvider = ({ children }) => {
  const [editingAddress, setEditingAddress] = useState(null);
  const { data: addressNames, isLoading } = useAddressNames();

  function editAddressName(address: string) {
    setEditingAddress(address);
  }

  return (
    <AddressBookProviderContext.Provider value={{ addressNames: addressNames || {}, isLoading, editAddressName }}>
      {!isLoading && (
        <EditAddressBookmarkModal address={editingAddress} addressNames={addressNames || {}} open={!!editingAddress} onClose={() => setEditingAddress(null)} />
      )}
      {children}
    </AddressBookProviderContext.Provider>
  );
};

// Hook
export function useAddressBook() {
  return { ...React.useContext(AddressBookProviderContext) };
}
