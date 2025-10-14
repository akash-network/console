"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Button } from "@akashnetwork/ui/components";
import { Activity, ArrowRight, DollarSign, Home, Settings } from "iconoir-react";

import { useAuth0 } from "@src/context/Auth0Provider";
import { useAuth } from "@src/context/AuthProvider";

export default function DashboardPage() {
  const { user } = useAuth0();
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <Home className="mr-3 h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">Akash at Home Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Welcome, {user?.name || user?.email}</span>
              <Button variant="outline" onClick={logout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="mb-2 text-3xl font-bold text-gray-900">Your Akash at Home Node</h2>
          <p className="text-gray-600">Monitor your device performance and earnings</p>
        </div>

        {/* Stats Cards */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="rounded-lg bg-green-100 p-2">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">$0.00</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Activity className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Uptime</p>
                  <p className="text-2xl font-bold text-gray-900">0h 0m</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="rounded-lg bg-purple-100 p-2">
                  <Settings className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className="text-2xl font-bold text-gray-900">Offline</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="rounded-lg bg-orange-100 p-2">
                  <Home className="h-6 w-6 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Node ID</p>
                  <p className="text-2xl font-bold text-gray-900">--</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Device Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Device Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <span className="text-sm font-medium text-gray-600">CPU Usage</span>
                  <span className="text-sm text-gray-900">0%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <span className="text-sm font-medium text-gray-600">Memory Usage</span>
                  <span className="text-sm text-gray-900">0%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <span className="text-sm font-medium text-gray-600">Disk Usage</span>
                  <span className="text-sm text-gray-900">0%</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-gray-50 p-4">
                  <span className="text-sm font-medium text-gray-600">Network Status</span>
                  <span className="text-sm text-gray-900">Disconnected</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Device is offline</p>
                    <p className="text-xs text-gray-500">Just now</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Waiting for setup</p>
                    <p className="text-xs text-gray-500">5 minutes ago</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 rounded-lg bg-gray-50 p-3">
                  <div className="h-2 w-2 rounded-full bg-gray-400"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Account created</p>
                    <p className="text-xs text-gray-500">1 hour ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center space-x-4">
          <Button className="bg-green-600 text-white hover:bg-green-700" onClick={() => (window.location.href = "/akash-at-home/setup")}>
            <Settings className="mr-2 h-4 w-4" />
            Setup Device
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button variant="outline">
            <Activity className="mr-2 h-4 w-4" />
            View Logs
          </Button>
        </div>
      </div>
    </div>
  );
}
