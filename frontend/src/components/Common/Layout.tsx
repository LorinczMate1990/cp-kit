import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authSlice';
import { useWebSocket } from '../../hooks/useWebSocket';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
  fetchNotificationPreferences,
  updateNotificationPreferences
} from '../../services/api';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, organization, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const { isConnected, addHandler } = useWebSocket();

  // A dashboard created by anyone in the organization refreshes the dashboard lists.
  // Subscribed here, on Layout's connection, because every useWebSocket() call opens its own socket.
  useEffect(
    () => {
      return addHandler((message) => {
        if (message.type === 'dashboard_created') {
          queryClient.invalidateQueries({ queryKey: ['dashboards'] });
        }
      })
    },
    [addHandler, queryClient]
  );

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications
  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await fetchNotifications(true);
        setNotifications(data);
        setUnreadCount(data.length);
      } catch (error) {
        console.log('Failed to load notifications');
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      // Intentional flaw: doesn't update unread count immediately
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.log('Failed to mark all as read');
    }
  };

  const handleDeleteNotification = async (id: string) => {
    try {
      await deleteNotification(id);
      setNotifications(notifications.filter(n => n.id !== id));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.log('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.log('Failed to clear notifications');
    }
  };

  const handleOpenPreferences = async () => {
    // Intentional flaw: No loading state while fetching preferences
    const prefs = await fetchNotificationPreferences();
    setNotificationPrefs(prefs);
    setShowNotificationPrefs(true);
  };

  const handleSavePreferences = async (prefs: any) => {
    await updateNotificationPreferences(prefs);
    setNotificationPrefs(prefs);
    setShowNotificationPrefs(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = async (notification: any) => {
    await markNotificationRead(notification.id);
    setNotifications(notifications.filter((n) => n.id !== notification.id));

    if (notification.link) {
      navigate(notification.link);
    }
    setShowNotifications(false);
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboards' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/team', label: 'Team' },
    { path: '/webhooks', label: 'Webhooks' },
    { path: '/audit', label: 'Audit Logs' },
    { path: '/billing', label: 'Billing' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/dashboard" className="flex items-center">
              <span className="text-xl font-bold text-blue-600">InsightHub</span>
              {organization && (
                <span className="ml-2 text-sm text-gray-500">
                  / {organization.name}
                </span>
              )}
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    location.pathname.startsWith(item.path)
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* Connection status */}
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
                title={isConnected ? 'Connected' : 'Disconnected'}
              />

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-full relative"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  {notifications.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {notifications.length}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg z-50">
                    <div className="p-3 border-b font-medium flex justify-between items-center">
                      <span>Notifications</span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleMarkAllRead}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Mark all read
                        </button>
                        <button
                          onClick={handleClearAll}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Clear all
                        </button>
                        <button
                          onClick={handleOpenPreferences}
                          className="text-xs text-gray-600 hover:text-gray-800"
                        >
                          Preferences
                        </button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="p-3 border-b hover:bg-gray-50 cursor-pointer flex justify-between items-start"
                          >
                            <div onClick={() => handleNotificationClick(notification)} className="flex-1">
                              <div className="font-medium text-sm">
                                {notification.title}
                              </div>
                              <div className="text-sm text-gray-500">
                                {notification.message}
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-red-600 ml-2"
                            >
                              &times;
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No new notifications
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-md"
                >
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center">
                    {user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="hidden md:block text-sm">{user?.name}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50">
                    <Link
                      to="/settings"
                      className="block px-4 py-2 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Settings
                    </Link>
                    <Link
                      to="/organization"
                      className="block px-4 py-2 hover:bg-gray-100"
                      onClick={() => setShowUserMenu(false)}
                    >
                      Organization
                    </Link>
                    <hr />
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      {/* Click outside to close menus */}
      {(showNotifications || showUserMenu) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowNotifications(false);
            setShowUserMenu(false);
          }}
        />
      )}

      {/* Notification Preferences Modal */}
      {showNotificationPrefs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Notification Preferences</h2>
              <button
                onClick={() => setShowNotificationPrefs(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                &times;
              </button>
            </div>
            {/* Intentional flaw: No loading state - notificationPrefs could be null */}
            <div className="p-4">
              <div className="space-y-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationPrefs?.email ?? false}
                    onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email: e.target.checked })}
                    className="mr-2"
                  />
                  Email notifications
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationPrefs?.push ?? false}
                    onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push: e.target.checked })}
                    className="mr-2"
                  />
                  Push notifications
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={notificationPrefs?.slack ?? false}
                    onChange={(e) => setNotificationPrefs({ ...notificationPrefs, slack: e.target.checked })}
                    className="mr-2"
                  />
                  Slack notifications
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setShowNotificationPrefs(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSavePreferences(notificationPrefs)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
