import { createProxy } from "./createProxy";

interface User {
  id: number;
  name?: string;
}

interface Sdk {
  users: {
    list: (input?: { page?: number }) => Promise<User[]>;
    getById: (input: { id: number }) => Promise<User>;
    create: (input: { name: string }) => Promise<User>;
  };
  admin: {
    settings: {
      update: (input: { theme: string }) => Promise<{ success: boolean }>;
    };
  };
}

describe(createProxy.name, () => {
  describe("getKey", () => {
    it("returns path segments with input when input is provided", () => {
      const { proxy } = setup();
      const key = proxy.users.getById.getKey({ id: 123 });
      expect(key).toEqual(["users", { id: 123 }]);
    });

    it("returns path segments without input when input is undefined", () => {
      const { proxy } = setup();
      const key = proxy.users.list.getKey(undefined);
      expect(key).toEqual(["users"]);
    });

    it("returns path segments without input when input is null", () => {
      const { proxy } = setup();
      const key = proxy.users.list.getKey(null as unknown as undefined);
      expect(key).toEqual(["users"]);
    });
  });

  describe("useQuery", () => {
    it("calls useQuery with correct queryKey and queryFn", () => {
      const { proxy, sdk, useQuery } = setup();
      proxy.users.getById.useQuery({ id: 42 });

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["users", { id: 42 }]
        })
      );

      const queryFn = useQuery.mock.calls[0][0].queryFn;
      queryFn();
      expect(sdk.users.getById).toHaveBeenCalledWith({ id: 42 });
    });

    it("appends custom queryKey to the generated key", () => {
      const { proxy, useQuery } = setup();
      proxy.users.getById.useQuery({ id: 1 }, { queryKey: ["extra", "key"] });

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["users", { id: 1 }, "extra", "key"]
        })
      );
    });

    it("passes through additional options to useQuery", () => {
      const { proxy, useQuery } = setup();
      proxy.users.getById.useQuery({ id: 1 }, { enabled: false, staleTime: 5000 });

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
          staleTime: 5000
        })
      );
    });

    it("handles undefined input for optional parameters", () => {
      const { proxy, sdk, useQuery } = setup();
      proxy.users.list.useQuery(undefined);

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["users"]
        })
      );

      const queryFn = useQuery.mock.calls[0][0].queryFn;
      queryFn();
      expect(sdk.users.list).toHaveBeenCalledWith(undefined);
    });

    it("can proxy class instance", () => {
      class UserService {
        async getById(input: { id: number }) {
          return { id: input.id };
        }
      }
      const userService = new UserService();
      jest.spyOn(userService, "getById");
      const useQuery = jest.fn();
      const proxy = createProxy(userService, { useQuery });
      proxy.getById.useQuery({ id: 1 });
      const queryFn = useQuery.mock.calls[0][0].queryFn;
      queryFn();

      expect(userService.getById).toHaveBeenCalledWith({ id: 1 });
    });
  });

  describe("useMutation", () => {
    it("calls useMutation with correct mutationKey and mutationFn", () => {
      const { proxy, sdk, useMutation } = setup();
      proxy.users.create.useMutation();

      expect(useMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationKey: ["users"]
        })
      );

      const mutationFn = useMutation.mock.calls[0][0].mutationFn;
      mutationFn({ name: "John" });
      expect(sdk.users.create).toHaveBeenCalledWith({ name: "John" });
    });

    it("appends custom mutationKey to the generated key", () => {
      const { proxy, useMutation } = setup();
      proxy.users.create.useMutation({ mutationKey: ["custom"] });

      expect(useMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationKey: ["users", "custom"]
        })
      );
    });

    it("passes through additional options to useMutation", () => {
      const onSuccess = jest.fn();
      const { proxy, useMutation } = setup();
      proxy.users.create.useMutation({ onSuccess });

      expect(useMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          onSuccess
        })
      );
    });
  });

  describe("nested objects", () => {
    it("creates proxy for deeply nested methods", () => {
      const { proxy, sdk, useQuery } = setup();
      proxy.admin.settings.update.useQuery({ theme: "dark" });

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["admin", "settings", { theme: "dark" }]
        })
      );

      const queryFn = useQuery.mock.calls[0][0].queryFn;
      queryFn();
      expect(sdk.admin.settings.update).toHaveBeenCalledWith({ theme: "dark" });
    });

    it("generates correct getKey for nested methods", () => {
      const { proxy } = setup();
      const key = proxy.admin.settings.update.getKey({ theme: "light" });
      expect(key).toEqual(["admin", "settings", { theme: "light" }]);
    });
  });

  describe("caching", () => {
    it("returns the same proxy instance for the same object", () => {
      const sdk = createSdk();
      const proxy1 = createProxy(sdk);
      const proxy2 = createProxy(sdk);

      expect(proxy1).toBe(proxy2);
    });

    it("returns the same nested proxy for repeated access", () => {
      const { proxy } = setup();
      const users1 = proxy.users;
      const users2 = proxy.users;

      expect(users1).toBe(users2);
    });

    it("returns the same hooks object for repeated method access", () => {
      const { proxy } = setup();
      const getById1 = proxy.users.getById;
      const getById2 = proxy.users.getById;

      expect(getById1).toBe(getById2);
    });
  });

  describe("inputToKey option", () => {
    it("uses custom inputToKey function for query keys", () => {
      const sdk = createSdk();
      const proxy = createProxy(sdk, {
        inputToKey: (input: unknown) => {
          if (input && typeof input === "object" && "id" in input) {
            return [(input as { id: number }).id];
          }
          return [];
        }
      });

      const key = proxy.users.getById.getKey({ id: 99 });
      expect(key).toEqual(["users", 99]);
    });

    it("applies custom inputToKey in useQuery", () => {
      const sdk = createSdk();
      const useQuery = jest.fn();
      const proxy = createProxy(sdk, {
        inputToKey: (input: unknown) => (input ? [JSON.stringify(input)] : []),
        useQuery
      });

      proxy.users.getById.useQuery({ id: 5 });

      expect(useQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["users", '{"id":5}']
        })
      );
    });
  });

  describe("edge cases", () => {
    it("returns undefined for non-existent properties", () => {
      const { proxy } = setup();
      expect((proxy as Record<string, unknown>).nonExistent).toBeUndefined();
    });

    it("returns primitive values as-is", () => {
      const sdk = {
        version: "1.0.0",
        count: 42
      };
      const proxy = createProxy(sdk);

      expect(proxy.version).toBe("1.0.0");
      expect(proxy.count).toBe(42);
    });

    it("handles null values in object", () => {
      const sdk = {
        nullValue: null as null,
        users: {
          list: jest.fn()
        }
      };
      const proxy = createProxy(sdk);

      expect(proxy.nullValue).toBeNull();
    });
  });

  function setup() {
    const sdk = createSdk();
    const useQuery = jest.fn();
    const useMutation = jest.fn();
    const proxy = createProxy(sdk, {
      useQuery,
      useMutation
    });
    return { sdk, proxy, useQuery, useMutation };
  }

  function createSdk(): Sdk {
    return {
      users: {
        list: jest.fn().mockResolvedValue([]),
        getById: jest.fn().mockResolvedValue({ id: 1 }),
        create: jest.fn().mockResolvedValue({ id: 1 })
      },
      admin: {
        settings: {
          update: jest.fn().mockResolvedValue({ success: true })
        }
      }
    };
  }
});
