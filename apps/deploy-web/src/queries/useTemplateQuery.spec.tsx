import type { TemplateHttpService } from "@akashnetwork/http-sdk";
import type { UserProfile } from "@auth0/nextjs-auth0/client";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import type { AxiosInstance } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Props as ServicesProviderProps } from "@src/context/ServicesProvider";
import type { ITemplate } from "@src/types";
import { CustomSnackbarProvider } from "../../../../packages/ui/context/CustomSnackbarProvider";
import { setupQuery } from "../../tests/unit/query-client";
import {
  useAddFavoriteTemplate,
  useDeleteTemplate,
  useRemoveFavoriteTemplate,
  useSaveUserTemplate,
  useTemplate,
  useTemplates,
  useUserFavoriteTemplates,
  useUserTemplates
} from "./useTemplateQuery";

import { act, screen } from "@testing-library/react";

const mockTemplate: ITemplate = {
  id: "template-1",
  title: "Test Template",
  description: "Test Description",
  sdl: "version: '2.0'",
  isPublic: true,
  cpu: 1000,
  ram: 1024,
  storage: 2048,
  username: "test-user",
  isFavorite: false,
  userId: "user-123"
};

const mockTemplateCategory = {
  title: "Web Applications",
  templates: [
    {
      id: "template-1",
      title: "Test Template",
      description: "Test Description",
      githubUrl: "https://github.com/test",
      summary: "Test summary",
      readme: "Test readme",
      deploy: "Test deploy",
      guide: "Test guide",
      logoUrl: "https://example.com/logo.png",
      persistentStorageEnabled: false,
      category: "Web Applications"
    }
  ]
};

describe("useTemplateQuery", () => {
  describe(useUserTemplates.name, () => {
    it("fetches user templates successfully", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.get.mockResolvedValue({ data: [mockTemplate] });

      const { result } = setupQuery(() => useUserTemplates("test-user"), {
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/templates/test-user");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual([mockTemplate]);
      });
    });

    it("handles error when fetching user templates", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch templates"));

      const { result } = setupQuery(() => useUserTemplates("test-user"), {
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useUserFavoriteTemplates", () => {
    it("fetches user favorite templates successfully", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      const favoriteTemplates = [{ id: "template-1", title: "Favorite Template" }];
      consoleApiHttpClient.get.mockResolvedValue({ data: favoriteTemplates });

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/favoriteTemplates");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(favoriteTemplates);
      });
    });

    it("handles error when fetching user favorite templates", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.get.mockRejectedValue(new Error("Failed to fetch favorite templates"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; user?: UserProfile }) {
      return setupQuery(() => useUserFavoriteTemplates(), {
        services: input?.services,
        wrapper: ({ children }) => <UserProvider user={input?.user || { email: "test@akash.network" }}>{children}</UserProvider>
      });
    }
  });

  describe(useTemplate.name, () => {
    it("fetches single template successfully", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.get.mockResolvedValue({ data: mockTemplate });

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(consoleApiHttpClient.get).toHaveBeenCalledWith("/v1/user/template/template-1");
        expect(result.current.isSuccess).toBe(true);
        expect(result.current.data).toEqual(mockTemplate);
      });
    });

    it("handles error when fetching single template", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.get.mockRejectedValue(new Error("Template not found"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; templateId?: string }) {
      return setupQuery(() => useTemplate(input?.templateId || "template-1"), {
        services: input?.services
      });
    }
  });

  describe(useSaveUserTemplate.name, () => {
    it("saves template successfully", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.post.mockResolvedValue({ data: "saved-template-id" });

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      const templateData = {
        title: "New Template",
        sdl: "version: '2.0'",
        isPublic: true
      };

      act(() => result.current.mutate(templateData));
      await vi.waitFor(() => {
        expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/saveTemplate", {
          id: undefined,
          sdl: "version: '2.0'",
          isPublic: true,
          title: "New Template",
          description: undefined,
          cpu: undefined,
          ram: undefined,
          storage: undefined
        });
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("handles error when saving template", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.post.mockRejectedValue(new Error("Failed to save template"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      const templateData = { title: "New Template", sdl: "version: '2.0'" };

      act(() => result.current.mutate(templateData));
      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"] }) {
      return setupQuery(() => useSaveUserTemplate(), {
        services: input?.services
      });
    }
  });

  describe(useDeleteTemplate.name, () => {
    it("deletes template successfully", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.delete.mockResolvedValue({});

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(() => {
        expect(consoleApiHttpClient.delete).toHaveBeenCalledWith("/v1/user/deleteTemplate/template-1");
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("handles error when deleting template", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.delete.mockRejectedValue(new Error("Failed to delete template"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; templateId?: string }) {
      return setupQuery(() => useDeleteTemplate(input?.templateId || "template-1"), {
        services: input?.services,
        wrapper: ({ children }) => <UserProvider user={{ email: "test@example.com" }}>{children}</UserProvider>
      });
    }
  });

  describe("useAddFavoriteTemplate", () => {
    it("adds favorite template successfully and shows snackbar", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.post.mockResolvedValue({});

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(async () => {
        expect(consoleApiHttpClient.post).toHaveBeenCalledWith("/v1/user/addFavoriteTemplate/template-1");
        expect(result.current.isSuccess).toBe(true);
        expect(await screen.findByText(/Favorite added!/i)).toBeInTheDocument();
      });
    });

    it("handles error when adding favorite template", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.post.mockRejectedValue(new Error("Failed to add favorite"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; templateId?: string }) {
      return setupQuery(() => useAddFavoriteTemplate(input?.templateId || "template-1"), {
        services: input?.services,
        wrapper: ({ children }) => <CustomSnackbarProvider>{children}</CustomSnackbarProvider>
      });
    }
  });

  describe("useRemoveFavoriteTemplate", () => {
    it("removes favorite template successfully and shows snackbar", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.delete.mockResolvedValue({});

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(async () => {
        expect(consoleApiHttpClient.delete).toHaveBeenCalledWith("/v1/user/removeFavoriteTemplate/template-1");
        expect(result.current.isSuccess).toBe(true);
        expect(await screen.findByText(/Favorite removed/i)).toBeInTheDocument();
      });
    });

    it("handles error when removing favorite template", async () => {
      const consoleApiHttpClient = mock<AxiosInstance>();
      consoleApiHttpClient.delete.mockRejectedValue(new Error("Failed to remove favorite"));

      const { result } = setup({
        services: {
          consoleApiHttpClient: () => consoleApiHttpClient
        }
      });

      act(() => result.current.mutate());
      await vi.waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"]; templateId?: string }) {
      return setupQuery(() => useRemoveFavoriteTemplate(input?.templateId || "template-1"), {
        services: input?.services,
        wrapper: ({ children }) => <CustomSnackbarProvider>{children}</CustomSnackbarProvider>
      });
    }
  });

  describe("useTemplates", () => {
    it("fetches templates grouped by category successfully", async () => {
      const templateService = mock<TemplateHttpService>({
        findGroupedByCategory: vi.fn().mockResolvedValue({
          data: [mockTemplateCategory]
        })
      });

      const { result } = setup({
        services: {
          template: () => templateService
        }
      });

      await vi.waitFor(() => {
        expect(templateService.findGroupedByCategory).toHaveBeenCalled();
        expect(result.current.categories).toHaveLength(1);
        expect(result.current.templates).toHaveLength(1);
        expect(result.current.categories[0].title).toBe("Web Applications");
      });
    });

    it("handles empty response when fetching templates", async () => {
      const templateService = mock<TemplateHttpService>({
        findGroupedByCategory: vi.fn().mockResolvedValue({
          data: null
        })
      });

      const { result } = setup({
        services: {
          template: () => templateService
        }
      });

      await vi.waitFor(() => {
        expect(templateService.findGroupedByCategory).toHaveBeenCalled();
        expect(result.current.categories).toEqual([]);
        expect(result.current.templates).toEqual([]);
      });
    });

    it("handles error when fetching templates", async () => {
      const templateService = mock<TemplateHttpService>({
        findGroupedByCategory: vi.fn().mockRejectedValue(new Error("Failed to fetch templates"))
      });

      const { result } = setup({
        services: {
          template: () => templateService
        }
      });

      expect(result.current.isLoading).toBe(true);

      await vi.waitFor(() => {
        expect(result.current.categories).toEqual([]);
        expect(result.current.templates).toEqual([]);
        expect(result.current.isLoading).toBe(false);
      });
    });

    function setup(input?: { services?: ServicesProviderProps["services"] }) {
      return setupQuery(() => useTemplates(), {
        services: input?.services
      });
    }
  });
});
