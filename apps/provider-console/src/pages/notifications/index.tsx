import React, { useEffect, useState } from "react";
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { Calendar, Clock } from "iconoir-react";

import { Layout } from "@src/components/layout/Layout";
import { HistoryTable } from "@src/components/notifications/HistoryTable";
import { MaintenanceForm } from "@src/components/notifications/MaintenanceForm";
import { NoticeDetailsDrawer } from "@src/components/notifications/NoticeDetailsDrawer";
import { PreviewPanel } from "@src/components/notifications/PreviewPanel";
import { withAuth } from "@src/components/shared/withAuth";
import { useCreateNotificationDraft, useNotifications, useSendNotification } from "@src/queries/useNotifications";
import type { Notification, NotificationDraftInput } from "@src/types/notification";

const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("create");
  const [selectedNotice, setSelectedNotice] = useState<Notification | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewData, setPreviewData] = useState<NotificationDraftInput | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);

  const pageSize = 20;

  // Queries
  const { data: noticesData, isLoading: isLoadingNotices } = useNotifications(currentPage, pageSize, "any");

  // Mutations
  const { mutate: createDraft, isPending: isCreatingDraft } = useCreateNotificationDraft();
  const { mutate: sendNotice, isPending: isSendingNotice } = useSendNotification();

  // Initialize tab based on existing notices
  useEffect(() => {
    if (noticesData && noticesData.items.length > 0 && activeTab === "create") {
      // If there are existing notices, remember the last tab from localStorage
      const lastTab = localStorage.getItem("notifications-tab");
      if (lastTab && ["create", "history"].includes(lastTab)) {
        setActiveTab(lastTab);
      }
    }
  }, [noticesData, activeTab]);

  // Save tab preference
  useEffect(() => {
    localStorage.setItem("notifications-tab", activeTab);
  }, [activeTab]);

  const handleCreateDraft = (data: NotificationDraftInput) => {
    createDraft(data, {
      onSuccess: response => {
        setDraftId(response.id);
        setPreviewData(data);
        // Auto-switch to history tab after creating
        setActiveTab("history");
      }
    });
  };

  const handlePreview = (data: NotificationDraftInput) => {
    setPreviewData(data);
    // Create draft for preview
    createDraft(data, {
      onSuccess: response => {
        setDraftId(response.id);
      }
    });
  };

  const handleSendNotice = () => {
    if (draftId) {
      sendNotice(draftId, {
        onSuccess: () => {
          setDraftId(null);
          setPreviewData(null);
          setActiveTab("history");
        }
      });
    }
  };

  const handleViewDetails = (notice: Notification) => {
    setSelectedNotice(notice);
    setIsDetailsOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsOpen(false);
    setSelectedNotice(null);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const totalPages = noticesData ? Math.ceil(noticesData.total / pageSize) : 0;
  const rateLimitRemaining = undefined; // Rate limit info comes from draft creation, not from list

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Send notifications to your users</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Create
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Create Tab */}
          <TabsContent value="create" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <MaintenanceForm
                  onSubmit={handleCreateDraft}
                  onPreview={handlePreview}
                  isLoading={isCreatingDraft || isSendingNotice}
                  isPreviewLoading={isCreatingDraft}
                  rateLimitRemaining={rateLimitRemaining}
                />
              </div>
              <div>
                <PreviewPanel formData={previewData || undefined} isLoading={isCreatingDraft} />
              </div>
            </div>

            {/* Send Button - only show if we have a draft */}
            {draftId && previewData && (
              <div className="flex justify-center">
                <Button onClick={handleSendNotice} disabled={isSendingNotice} size="lg" className="px-8">
                  {isSendingNotice ? "Sending..." : "Send Notification"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <HistoryTable
              notices={noticesData?.items || []}
              isLoading={isLoadingNotices}
              onViewDetails={handleViewDetails}
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </TabsContent>
        </Tabs>

        {/* Details Drawer */}
        <NoticeDetailsDrawer notice={selectedNotice} isOpen={isDetailsOpen} onClose={handleCloseDetails} />
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: NotificationsPage, authLevel: "provider" });
